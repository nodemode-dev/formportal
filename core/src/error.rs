use std::fmt;

use crate::CatalogError;

#[derive(Debug)]
pub enum CoreError {
    Io(std::io::Error),
    Http(String),
    Catalog(CatalogError),
    Url(String),
    Hash { file: String, expected: String, found: String },
    Signature(String),
    Unsupported(String),
    Unavailable(String),
    NotInstalled(String),
    State(String),
    Archive(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoreError::Io(e) => write!(f, "a file could not be read or written: {e}"),
            CoreError::Http(e) => write!(f, "the download did not complete: {e}"),
            CoreError::Catalog(e) => write!(f, "{e}"),
            CoreError::Url(url) => write!(f, "refused address {url:?}: only https, or http on this computer, is fetched"),
            CoreError::Hash { file, expected, found } => {
                write!(f, "{file} does not match the catalogue: expected SHA-256 {expected}, found {found}. It was not installed")
            }
            CoreError::Unsupported(kind) => write!(f, "this build cannot install a {kind} file yet"),
            CoreError::Signature(why) => write!(f, "the catalogue was refused: {why}"),
            CoreError::Unavailable(what) => write!(f, "the catalogue offers this computer nothing for {what}"),
            CoreError::NotInstalled(what) => write!(f, "{what} is not installed"),
            CoreError::State(e) => write!(f, "the record of installed apps could not be read: {e}"),
            CoreError::Archive(e) => write!(f, "the archive could not be unpacked: {e}"),
        }
    }
}

impl std::error::Error for CoreError {}

impl From<std::io::Error> for CoreError {
    fn from(e: std::io::Error) -> Self {
        CoreError::Io(e)
    }
}

impl From<CatalogError> for CoreError {
    fn from(e: CatalogError) -> Self {
        CoreError::Catalog(e)
    }
}
