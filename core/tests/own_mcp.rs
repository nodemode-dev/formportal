use std::path::Path;

use formportal_core::agents::{client_rows, own_command, Client, CLIENTS, OWN_ARG, OWN_SERVER};

fn args(list: &[&str]) -> Vec<String> {
    list.iter().map(|a| a.to_string()).collect()
}

#[test]
fn the_client_table_names_every_client_once_with_the_label_the_engine_uses() {
    let rows = client_rows();
    let table: serde_json::Value = serde_json::from_str(formportal_core::agents::CLIENT_TABLE).unwrap();
    assert_eq!(rows.len(), table["clients"].as_array().unwrap().len(), "a row names a client the engine does not have");
    assert_eq!(rows.iter().map(|(client, _)| *client).collect::<Vec<Client>>(), CLIENTS);
    for (client, row) in &rows {
        assert_eq!(row.label, client.label());
        assert_eq!(Client::parse(&row.id), Some(*client));
        assert!(!row.programs.is_empty(), "{}", row.id);
    }
}

#[test]
fn an_entry_is_formportals_own_by_its_program_and_the_one_argument() {
    let here = Path::new("/opt/renamed/portal.AppImage");
    assert_eq!((OWN_SERVER, OWN_ARG), ("formportal", "mcp"));
    for command in ["/Applications/FormPortal.app/Contents/MacOS/FormPortal", "/usr/bin/formportal", "C:\\Program Files\\FormPortal\\formportal.exe", "/home/someone/formportal/formportal", "C:\\src\\formportal\\formportal.bat", "/home/someone/Apps/FormPortal_0.66.0_amd64.AppImage", "/opt/tools/formportal-cli", "/opt/renamed/portal.AppImage"] {
        assert!(own_command(command, &args(&["mcp"]), here), "{command}");
    }
    assert!(!own_command("/usr/bin/formportal", &args(&["app-mcp", "formvis"]), here));
    assert!(!own_command("/usr/bin/formportal", &args(&["mcp", "--read-only"]), here));
    assert!(!own_command("/usr/bin/formportal", &[], here));
    assert!(!own_command("npx", &args(&["mcp"]), here));
    assert!(!own_command("/opt/other/portal.AppImage", &args(&["mcp"]), here));
    assert!(!own_command("node", &args(&["/opt/formportal/server.js"]), here));
}
