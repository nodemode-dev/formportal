use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde::Serialize;

use crate::error::Result;
use crate::portal::channel_name;
use crate::{process, Catalog, Channel, Platform, Portal};

const FRESH: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Finding {
    pub kind: String,
    pub product: Option<String>,
    pub channel: Option<Channel>,
    pub path: PathBuf,
    pub bytes: u64,
    pub problem: String,
    pub fix: String,
    pub fixed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Report {
    pub checked: usize,
    pub findings: Vec<Finding>,
    pub fixed: usize,
    pub freed: u64,
}

fn size(path: &Path) -> u64 {
    let Ok(meta) = fs::symlink_metadata(path) else { return 0 };
    if meta.is_dir() {
        fs::read_dir(path).map(|it| it.filter_map(|e| e.ok()).map(|e| size(&e.path())).sum()).unwrap_or(0)
    } else {
        meta.len()
    }
}

fn old_enough(path: &Path) -> bool {
    fs::metadata(path).and_then(|m| m.modified()).ok().and_then(|t| SystemTime::now().duration_since(t).ok()).map(|age| age > FRESH).unwrap_or(true)
}

fn finding(kind: &str, product: Option<&str>, channel: Option<Channel>, path: &Path, problem: String, fix: String) -> Finding {
    Finding { kind: kind.to_string(), product: product.map(str::to_string), channel, path: path.to_path_buf(), bytes: size(path), problem, fix, fixed: false, error: None }
}

impl Portal {
    pub fn repair(&self, catalog: Option<&Catalog>, platform: Platform, fix: bool, progress: &mut dyn FnMut(&str, Channel, u64, u64)) -> Result<Report> {
        let state = self.state()?;
        let mut findings = Vec::new();
        let mut known: BTreeSet<PathBuf> = BTreeSet::new();

        for install in &state.installs {
            known.insert(install.current.path.clone());
            let name = format!("{} {}{}", install.product, install.current.version, if install.channel == Channel::Stable { String::new() } else { format!(" ({})", channel_name(install.channel)) });
            let release = catalog.and_then(|c| c.release_of(&install.product, install.channel, &install.current.version));
            let artifact = release.and_then(|r| r.artifact_for(platform)).filter(|a| a.sha256 == install.current.sha256);
            let fix_text = if artifact.is_some() { "install the same version again from the catalogue, checking its SHA-256".to_string() } else { "forget the record; the catalogue no longer offers this exact file, so install the app again from Apps".to_string() };
            if !install.current.path.exists() {
                findings.push(finding("missing", Some(&install.product), Some(install.channel), &install.current.path, format!("{name} is recorded as installed but its folder is gone"), fix_text));
            } else if self.launch_target(&install.product, install.channel).is_err() {
                findings.push(finding("broken", Some(&install.product), Some(install.channel), &install.current.path, format!("{name} has nothing FormPortal can open in its folder"), fix_text));
            }
            if let Some(previous) = &install.previous {
                known.insert(previous.path.clone());
                if !previous.path.exists() {
                    findings.push(finding("previous", Some(&install.product), Some(install.channel), &previous.path, format!("the kept earlier version of {} ({}) is gone", install.product, previous.version), "forget it, so Go back is not offered for a version that is not there".to_string()));
                }
            }
        }

        let apps = self.root().join("apps");
        for product_dir in fs::read_dir(&apps).map(|it| it.filter_map(|e| e.ok()).map(|e| e.path()).collect::<Vec<_>>()).unwrap_or_default() {
            for channel_dir in fs::read_dir(&product_dir).map(|it| it.filter_map(|e| e.ok()).map(|e| e.path()).collect::<Vec<_>>()).unwrap_or_default() {
                for version_dir in fs::read_dir(&channel_dir).map(|it| it.filter_map(|e| e.ok()).map(|e| e.path()).collect::<Vec<_>>()).unwrap_or_default() {
                    if known.contains(&version_dir) || !version_dir.is_dir() || !old_enough(&version_dir) || !process::under(&version_dir).is_empty() {
                        continue;
                    }
                    let product = product_dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                    let label = version_dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                    let (kind, problem) = if label.ends_with(".tmp") {
                        ("staging", format!("an install of {product} that did not finish left {label} behind"))
                    } else {
                        ("leftover", format!("{product} {label} is on disk but no install record points to it"))
                    };
                    findings.push(finding(kind, Some(&product), None, &version_dir, problem, "delete the folder".to_string()));
                }
            }
        }

        let downloads = self.root().join("downloads");
        for file in fs::read_dir(&downloads).map(|it| it.filter_map(|e| e.ok()).map(|e| e.path()).collect::<Vec<_>>()).unwrap_or_default() {
            if old_enough(&file) {
                let label = file.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                findings.push(finding("download", None, None, &file, format!("{label} is a download that was not cleaned up"), "delete it".to_string()));
            }
        }

        let checked = state.installs.len();
        if !fix {
            return Ok(Report { checked, freed: 0, fixed: 0, findings });
        }

        let mut freed = 0;
        for f in findings.iter_mut() {
            let outcome: Result<()> = match f.kind.as_str() {
                "missing" | "broken" => {
                    let (product, channel) = (f.product.clone().unwrap_or_default(), f.channel.unwrap_or(Channel::Stable));
                    let record = self.state()?.get(&product, channel).cloned();
                    match record {
                        Some(record) => {
                            let artifact = catalog
                                .and_then(|c| c.release_of(&product, channel, &record.current.version))
                                .and_then(|r| r.artifact_for(platform))
                                .filter(|a| a.sha256 == record.current.sha256)
                                .cloned();
                            match artifact {
                                Some(artifact) => self.install(&product, channel, &record.current.version, &artifact, &mut |have, total| progress(&product, channel, have, total)).map(|_| ()),
                                None => {
                                    let mut s = self.state()?;
                                    if let Some(i) = s.position(&product, channel) {
                                        s.installs.remove(i);
                                    }
                                    s.save(self.root())
                                }
                            }
                        }
                        None => Ok(()),
                    }
                }
                "previous" => {
                    let mut s = self.state()?;
                    let (product, channel) = (f.product.clone().unwrap_or_default(), f.channel.unwrap_or(Channel::Stable));
                    if let Some(i) = s.position(&product, channel) {
                        s.installs[i].previous = None;
                    }
                    s.save(self.root())
                }
                _ => {
                    let gone = if !f.path.exists() { Ok(()) } else if f.path.is_dir() { fs::remove_dir_all(&f.path) } else { fs::remove_file(&f.path) };
                    if gone.is_ok() {
                        freed += f.bytes;
                    }
                    gone.map_err(Into::into)
                }
            };
            match outcome {
                Ok(()) => f.fixed = true,
                Err(e) => f.error = Some(e.to_string()),
            }
        }
        let fixed = findings.iter().filter(|f| f.fixed).count();
        Ok(Report { checked, findings, fixed, freed })
    }
}
