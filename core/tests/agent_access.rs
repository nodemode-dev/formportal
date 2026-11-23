mod support;

use formportal_core::access::{self, Choice, ACCESS_FILE, BROKEN};
use formportal_core::CoreError;
use support::*;

const ACTIONS: [&str; 4] = ["install", "update", "rollback", "remove"];

fn refusal(root: &std::path::Path, action: &str) -> String {
    match access::gate(root, action) {
        Err(CoreError::Policy(text)) => text,
        other => panic!("{action} was not refused: {other:?}"),
    }
}

fn write_unsealed(root: &std::path::Path, choice: &str) {
    let text = format!("{{\n  \"format\": \"formportal-agent-access\",\n  \"format_version\": 1,\n  \"outside_agents\": \"{choice}\"\n}}\n");
    std::fs::write(root.join(ACCESS_FILE), text).unwrap();
}

#[test]
fn with_no_saved_choice_an_outside_agent_is_asked_to_use_the_window() {
    let dir = Scratch::new("access-none");
    let view = access::read(dir.path());
    assert_eq!((view.outside_agents, view.stored, view.seal, view.seal_broken), (Choice::Ask, Choice::Ask, "none", false));
    for action in ACTIONS {
        let text = refusal(dir.path(), action);
        assert!(text.starts_with(&format!("{action} was refused")), "{text}");
        assert!(text.contains("only its window can answer"), "{text}");
        assert!(!text.contains(BROKEN), "{text}");
    }
    assert!(!dir.path().join(ACCESS_FILE).exists(), "reading the choice writes nothing");
}

#[test]
fn a_saved_file_that_cannot_be_read_counts_as_ask_and_says_so() {
    let dir = Scratch::new("access-garbled");
    std::fs::write(dir.path().join(ACCESS_FILE), "{ not json").unwrap();
    let view = access::read(dir.path());
    assert_eq!((view.outside_agents, view.seal, view.seal_broken), (Choice::Ask, "broken", true));
    let text = refusal(dir.path(), "install");
    assert!(text.ends_with(BROKEN), "{text}");
    assert_eq!(std::fs::read_to_string(dir.path().join(ACCESS_FILE)).unwrap(), "{ not json");
}

#[test]
fn allowed_without_a_valid_seal_never_lets_an_agent_through() {
    let _env = env_lock();
    let dir = Scratch::new("access-unsealed-allowed");
    write_unsealed(dir.path(), "allowed");
    let view = access::read(dir.path());
    assert_eq!(view.stored, Choice::Allowed);
    assert_eq!(view.outside_agents, Choice::Ask);
    assert!(view.seal == "broken" || view.seal == "unavailable", "{view:?}");
    for action in ACTIONS {
        let text = refusal(dir.path(), action);
        assert!(text.contains("only its window can answer"), "{text}");
        if view.seal == "broken" {
            assert!(text.ends_with(BROKEN), "{text}");
        } else {
            assert!(text.contains("The system keychain is not available"), "{text}");
        }
    }
}

#[test]
fn blocked_without_a_seal_still_refuses() {
    let dir = Scratch::new("access-unsealed-blocked");
    write_unsealed(dir.path(), "blocked");
    for action in ACTIONS {
        refusal(dir.path(), action);
    }
}

#[cfg(feature = "seal-stand-in")]
#[test]
fn a_choice_sealed_by_the_window_holds_and_one_changed_outside_it_goes_back_to_ask() {
    let _env = env_lock();
    let dir = Scratch::new("access-sealed");
    let key = dir.path().join("stand-in.key");
    std::env::set_var("FORMPORTAL_SEAL_STAND_IN", &key);
    let root = dir.path().join("root");

    let view = access::set(&root, Choice::Allowed).unwrap();
    assert_eq!((view.outside_agents, view.seal, view.seal_broken), (Choice::Allowed, "sealed", false));
    for action in ACTIONS {
        access::gate(&root, action).unwrap();
    }

    access::set(&root, Choice::Blocked).unwrap();
    let text = refusal(&root, "remove");
    assert!(text.contains("outside agents are blocked"), "{text}");

    access::set(&root, Choice::Ask).unwrap();
    assert!(refusal(&root, "install").contains("only its window can answer"));

    access::set(&root, Choice::Blocked).unwrap();
    let saved = std::fs::read_to_string(root.join(ACCESS_FILE)).unwrap();
    std::fs::write(root.join(ACCESS_FILE), saved.replace("\"blocked\"", "\"allowed\"")).unwrap();
    let view = access::read(&root);
    assert_eq!((view.outside_agents, view.stored, view.seal, view.seal_broken), (Choice::Ask, Choice::Allowed, "broken", true));
    assert!(refusal(&root, "update").ends_with(BROKEN));

    access::set(&root, Choice::Allowed).unwrap();
    std::fs::remove_file(&key).unwrap();
    let view = access::read(&root);
    assert_eq!((view.outside_agents, view.seal_broken), (Choice::Ask, true));

    std::env::remove_var("FORMPORTAL_SEAL_STAND_IN");
    let view = access::set(&root, Choice::Allowed).unwrap();
    assert_eq!((view.outside_agents, view.stored, view.seal, view.seal_broken), (Choice::Ask, Choice::Allowed, "unavailable", false));
    assert!(refusal(&root, "install").contains("The system keychain is not available"));
    let view = access::set(&root, Choice::Blocked).unwrap();
    assert_eq!((view.outside_agents, view.seal), (Choice::Blocked, "unavailable"));
    assert!(refusal(&root, "rollback").contains("outside agents are blocked"));
}
