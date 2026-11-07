export interface Note {
  version: string;
  published: string;
  notes: string;
}

export interface Line {
  stable: Note[];
}

export const RELEASES: Record<string, Line> = {
  formvis: {
    stable: [
      {
        version: "1.99.7",
        published: "2026-11-05T17:00:00Z",
        notes: "No change to the app. A test added in 1.99.6, which checks which Python the install picks, failed on the Linux build service because it found the machine's own Python before the test's stand-ins, so 1.99.6 could not be released. The test now hides the machine's Pythons. This release carries 1.99.6's Intel Mac install fix.",
      },
      {
        version: "1.99.6",
        published: "2026-11-05T12:00:00Z",
        notes: "The Intel Mac build of FormVis still stopped while installing its Python libraries, with \"No matching distribution found for rawpy==0.25.1\". The backend installer now uses the same Python choice as the rest of setup, and if an Intel Mac already has an environment made with Python 3.14 it is made again with 3.13 or 3.12. Apple Silicon Macs, Windows and Linux are unchanged.",
      },
      {
        version: "1.99.5",
        published: "2026-11-05T09:00:00Z",
        notes: "The Apple Silicon Mac app can be notarized by Apple. The first signed build was rejected because two copies of Python's library inside the app had signatures that only hold inside Python.framework. The engine folder now leaves setup/freeze_backend with no links and no framework, so the app carries exactly what was signed. Windows, Linux and unsigned Mac builds run as before.",
      },
      {
        version: "1.99.4",
        published: "2026-11-05T06:00:00Z",
        notes: "FormVis installs and runs on Intel Macs again. Two of its libraries stopped making Intel Mac versions (onnxruntime after 1.23.2, which runs the local AI tools, and rawpy after 0.25.1, which opens camera RAW files), so on an Intel Mac the app now installs those two versions, and setup uses Python 3.13 or 3.12 there. Apple Silicon Macs, Windows and Linux are unchanged.",
      },
    ],
  },
  formlit: {
    stable: [
      {
        version: "0.48.0",
        published: "2026-11-05T17:00:00Z",
        notes: "The Intel Mac build of FormLit still stopped while installing its Python libraries, with \"No matching distribution found for rawpy==0.25.1\". Now the installer uses the same choice as the rest of setup, and if an Intel Mac already has an environment made with Python 3.14 it is made again with 3.13 or 3.12. Apple Silicon Macs, Linux and Windows are unchanged.",
      },
      {
        version: "0.47.9",
        published: "2026-11-05T11:00:00Z",
        notes: "FormLit installs again on Windows and on Intel Macs. The Windows install picked the newest Python on the machine (3.15 on the build service), and onnxruntime, which runs the local AI tools, has no version for Python 3.15 yet. Now the install uses Python 3.14, 3.13 or 3.12 (3.13 or 3.12 on an Intel Mac). Apple Silicon Macs and Linux are unchanged.",
      },
      {
        version: "0.47.8",
        published: "2026-11-04T16:00:00Z",
        notes: "The folder-removal test passes on macOS. No app change: removing a folder from the catalog only drops its catalog rows and leaves the files on disk, as before.",
      },
      {
        version: "0.47.7",
        published: "2026-11-04T10:00:00Z",
        notes: "README in the Form family template. No app change.",
      },
    ],
  },
  formskills: {
    stable: [
      {
        version: "0.7.7",
        published: "2026-11-04T17:00:00Z",
        notes: "README in the Form family template. The README's version is in its shields badge now, so the version check in core/tests/family_contract.rs reads it there.",
      },
      {
        version: "0.7.6",
        published: "2026-11-04T11:00:00Z",
        notes: "The README follows the Form family layout and has screenshots of the reader, library, search and format check. Nothing in the app changes.",
      },
      {
        version: "0.7.5",
        published: "2026-11-03T15:00:00Z",
        notes: "The app icon is the unified family icon on the desktop and in the window, and the app is named FormSkills in its window title and installer.",
      },
    ],
  },
};

export const CUT_NOTE = "From 2.5.7 to 2.6.2 the work that ran outside formcut is in it: a ledger of export jobs that finished jobs return from and a job caught mid-render is queued again, loudness set to a target under a true-peak ceiling, and a delivery check.\n\nhttps://github.com/nodemode-dev/formcut/releases/tag/v2.6.2";
