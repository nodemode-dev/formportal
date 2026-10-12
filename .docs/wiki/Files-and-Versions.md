# Files and Versions

FormPortal lists the Form projects in folders you choose on your own disk, opens each in the app that makes it, and keeps earlier versions you can go back to. Nothing leaves your computer.

## Folders

Files, Choose a folder (or Use the suggested folder, Documents/Form). FormPortal finds projects by each app's project extensions (`.fc` FormCut, `.fmv` and `.formvis` FormVis, `.fmw` FormWav, more as apps ship), up to six folders deep and 5,000 projects. Stop listing removes a folder from the list and deletes nothing.

## Versions

For each folder that keeps versions, FormPortal keeps up to 20 earlier versions of every project in its own folder (`history/`):

- While FormPortal's window is open, a version is kept within a few seconds of each save, once the file has stopped changing for two seconds, so a save in progress is never copied half-written. Saving twice in quick succession keeps one version; saving without a change keeps none.
- With FormPortal closed, the latest state is kept the next time FormPortal reads the folder. A Form app can also ask for a version after each save (`formportal cli file-versions --path FILE --action save`, or the `file_versions` MCP tool), which covers saves made while FormPortal is closed.
- `formportal cli watch` keeps versions the same way from a terminal, printing a JSON line for each.

Versions, Go back to this puts an earlier version back after keeping the current file as a version, so nothing is lost. Files over 256 MB are listed but not versioned. If a Versions window is open when you save, it says a new version was kept; Show it adds it to the list.

## Previews

When an app writes a preview beside a project as `[file].preview.webp` (WebP, at most 256 KB), Files shows it in the project's tile. FormPortal reads previews only from inside your projects folders.
