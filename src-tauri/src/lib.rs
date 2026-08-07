use chrono::{Local, NaiveDateTime, TimeZone};
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const VAULT_DIR_NAME: &str = "KensEditor";
const PINS_FILE_NAME: &str = ".pins.json";
const VERSIONS_DIR_NAME: &str = ".versions";
const ATTACHMENTS_DIR_NAME: &str = "Attachments";
const MAX_PASTED_IMAGE_BYTES: usize = 20 * 1024 * 1024;
const IMAGE_TYPE_ERROR: &str = "Only PNG, JPEG, GIF, and WebP images are supported";
const PREVIEW_MAX_CHARS: usize = 360;
const PREVIEW_READ_BYTES: usize = PREVIEW_MAX_CHARS * 4;

fn vault_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    Ok(home.join("Documents").join(VAULT_DIR_NAME))
}

fn ensure_vault_exists() -> Result<PathBuf, String> {
    let dir = vault_dir()?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, contents.as_bytes()).map_err(|error| error.to_string())?;
    fs::rename(&temp_path, path).map_err(|error| error.to_string())?;
    Ok(())
}

fn is_vault_text_file(path: &Path) -> bool {
    path.is_file() && path.extension().is_some_and(|extension| extension == "txt")
}

fn is_vault_path(path: &Path) -> Result<bool, String> {
    let vault = ensure_vault_exists()?;
    let canonical_vault = fs::canonicalize(&vault).map_err(|error| error.to_string())?;
    let canonical_path = fs::canonicalize(path).map_err(|error| error.to_string())?;
    Ok(canonical_path.starts_with(canonical_vault))
}

fn timestamp_ms(time: Result<std::time::SystemTime, std::io::Error>) -> Result<u64, String> {
    let time = time.map_err(|error| error.to_string())?;

    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .map_err(|error| error.to_string())
}

fn modified_ms(path: &Path) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    timestamp_ms(metadata.modified())
}

/// Creation time from vault filenames like `2026-07-09_151300.txt`
/// or `2026-07-09_151300_2.txt`. Falls back to None for nonstandard names.
fn created_ms_from_name(name: &str) -> Option<u64> {
    let stem = name.strip_suffix(".txt")?;
    let stamp = stem.get(..17)?;
    let naive = NaiveDateTime::parse_from_str(stamp, "%Y-%m-%d_%H%M%S").ok()?;
    let local = Local.from_local_datetime(&naive).single()?;
    u64::try_from(local.timestamp_millis()).ok()
}

fn created_ms(path: &Path, name: &str) -> Result<u64, String> {
    if let Some(ms) = created_ms_from_name(name) {
        return Ok(ms);
    }
    modified_ms(path)
}

fn clean_preview(text: &str) -> String {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let mut preview = normalized.as_str();

    while let Some(line_end) = preview.find('\n') {
        if preview[..line_end]
            .chars()
            .all(|ch| ch == ' ' || ch == '\t')
        {
            preview = &preview[line_end + 1..];
        } else {
            break;
        }
    }

    preview.trim_end().to_string()
}

fn preview_from_text(text: &str) -> String {
    let preview = clean_preview(text);

    if preview.is_empty() {
        return "(empty)".to_string();
    }

    let char_count = preview.chars().count();
    if char_count <= PREVIEW_MAX_CHARS {
        return preview;
    }

    let truncated: String = preview.chars().take(PREVIEW_MAX_CHARS).collect();
    format!("{truncated}…")
}

fn file_preview(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut buffer = vec![0u8; PREVIEW_READ_BYTES];
    let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
    buffer.truncate(read);

    Ok(preview_from_text(&String::from_utf8_lossy(&buffer)))
}

fn unique_vault_path(dir: &Path) -> PathBuf {
    let stamp = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
    let base = format!("{stamp}.txt");
    let mut path = dir.join(&base);

    if !path.exists() {
        return path;
    }

    for index in 2.. {
        path = dir.join(format!("{stamp}_{index}.txt"));
        if !path.exists() {
            return path;
        }
    }

    dir.join(format!("{stamp}_overflow.txt"))
}

fn pins_path(dir: &Path) -> PathBuf {
    dir.join(PINS_FILE_NAME)
}

fn read_pins(dir: &Path) -> Result<HashSet<String>, String> {
    let path = pins_path(dir);
    if !path.exists() {
        return Ok(HashSet::new());
    }

    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let names: Vec<String> = serde_json::from_str(&text).unwrap_or_default();
    Ok(names.into_iter().collect())
}

fn write_pins(dir: &Path, pins: &HashSet<String>) -> Result<(), String> {
    let path = pins_path(dir);
    if pins.is_empty() {
        if path.exists() {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
        return Ok(());
    }

    let mut names: Vec<&String> = pins.iter().collect();
    names.sort();
    let text = serde_json::to_string(&names).map_err(|error| error.to_string())?;
    write_atomic(&path, &text)
}

fn vault_file_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| name.ends_with(".txt"))
        .ok_or_else(|| "Not a vault document".to_string())
}

fn vault_document_stem(path: &Path) -> Result<String, String> {
    let vault = ensure_vault_exists()?;
    vault_document_stem_in_dir(path, &vault)
}

fn vault_document_stem_in_dir(path: &Path, vault: &Path) -> Result<String, String> {
    if !is_vault_text_file(path) {
        return Err("Not a vault document".to_string());
    }

    let canonical_vault = fs::canonicalize(vault).map_err(|error| error.to_string())?;
    let canonical_path = fs::canonicalize(path).map_err(|error| error.to_string())?;

    if canonical_path.parent() != Some(canonical_vault.as_path()) {
        return Err("Not a vault document".to_string());
    }

    canonical_path
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .filter(|stem| !stem.is_empty())
        .ok_or_else(|| "Not a vault document".to_string())
}

fn document_images_dir(document_path: &Path) -> Result<PathBuf, String> {
    let stem = vault_document_stem(document_path)?;
    Ok(ensure_vault_exists()?.join(ATTACHMENTS_DIR_NAME).join(stem))
}

fn document_versions_dir(document_path: &Path) -> Result<PathBuf, String> {
    let stem = vault_document_stem(document_path)?;
    Ok(ensure_vault_exists()?.join(VERSIONS_DIR_NAME).join(stem))
}

fn version_created_ms(name: &str) -> Option<u64> {
    let stamp = name.strip_suffix(".txt")?.get(..21)?;
    let naive = NaiveDateTime::parse_from_str(stamp, "%Y-%m-%d_%H%M%S_%3f").ok()?;
    let local = Local.from_local_datetime(&naive).single()?;
    u64::try_from(local.timestamp_millis()).ok()
}

fn unique_version_path(dir: &Path) -> PathBuf {
    let stamp = Local::now().format("%Y-%m-%d_%H%M%S_%3f");
    unique_version_path_with_stamp(dir, &stamp.to_string())
}

fn unique_version_path_with_stamp(dir: &Path, stamp: &str) -> PathBuf {
    let mut path = dir.join(format!("{stamp}.txt"));

    if !path.exists() {
        return path;
    }

    for index in 2.. {
        path = dir.join(format!("{stamp}_{index}.txt"));
        if !path.exists() {
            return path;
        }
    }

    dir.join(format!("{stamp}_overflow.txt"))
}

fn checked_version_id(version_id: &str) -> Result<&Path, String> {
    let id_path = Path::new(version_id);
    if id_path.components().count() != 1
        || id_path
            .extension()
            .is_none_or(|extension| extension != "txt")
    {
        return Err("Invalid version".to_string());
    }

    Ok(id_path)
}

fn checked_version_path_in_dir(dir: &Path, version_id: &str) -> Result<PathBuf, String> {
    Ok(dir.join(checked_version_id(version_id)?))
}

fn checked_version_path(document_path: &Path, version_id: &str) -> Result<PathBuf, String> {
    let id_path = checked_version_id(version_id)?;
    Ok(document_versions_dir(document_path)?.join(id_path))
}

fn image_extension(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_string_lossy().to_lowercase();
    matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp").then_some(extension)
}

fn next_image_path(dir: &Path, source: &Path) -> Result<PathBuf, String> {
    let original_name = source
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "Invalid image file".to_string())?;
    let mut highest = 0u32;

    if dir.is_dir() {
        for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let Some((prefix, _)) = name.split_once('_') else {
                continue;
            };
            if let Ok(index) = prefix.parse::<u32>() {
                highest = highest.max(index);
            }
        }
    }

    let index = highest
        .checked_add(1)
        .ok_or_else(|| "Too many images".to_string())?;
    Ok(dir.join(format!("{index:03}_{original_name}")))
}

fn store_document_image(
    dir: &Path,
    source_name: &Path,
    write: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    if image_extension(source_name).is_none() {
        return Err(IMAGE_TYPE_ERROR.to_string());
    }

    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let target = next_image_path(dir, source_name)?;
    let temp = target.with_extension("tmp");

    if let Err(error) = write(&temp) {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    if let Err(error) = fs::rename(&temp, &target) {
        let _ = fs::remove_file(&temp);
        return Err(error.to_string());
    }
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentImage {
    name: String,
    path: String,
}

fn read_document_images(dir: &Path) -> Result<Vec<DocumentImage>, String> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut images = Vec::new();
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_file()
            || image_extension(&path).is_none()
        {
            continue;
        }

        images.push(DocumentImage {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: path.to_string_lossy().into_owned(),
        });
    }
    images.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(images)
}

fn checked_document_image(document_path: &Path, image_path: &Path) -> Result<PathBuf, String> {
    let dir = document_images_dir(document_path)?;
    let canonical_dir = fs::canonicalize(&dir).map_err(|error| error.to_string())?;
    let canonical_image = fs::canonicalize(image_path).map_err(|error| error.to_string())?;

    if canonical_image.parent() != Some(canonical_dir.as_path())
        || image_extension(&canonical_image).is_none()
    {
        return Err("Not an image for this document".to_string());
    }

    Ok(canonical_image)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultDocument {
    name: String,
    path: String,
    created_ms: u64,
    preview: String,
    pinned: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentVersion {
    id: String,
    number: usize,
    created_ms: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveVersionResult {
    created: bool,
    version: DocumentVersion,
}

fn read_document_versions(dir: &Path) -> Result<Vec<DocumentVersion>, String> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut versions = Vec::new();
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !is_vault_text_file(&path) {
            continue;
        }

        let id = entry.file_name().to_string_lossy().into_owned();
        versions.push(DocumentVersion {
            number: 0,
            created_ms: version_created_ms(&id).unwrap_or(modified_ms(&path)?),
            id,
        });
    }

    versions.sort_by(|left, right| {
        right
            .created_ms
            .cmp(&left.created_ms)
            .then(right.id.cmp(&left.id))
    });
    let version_count = versions.len();
    for (index, version) in versions.iter_mut().enumerate() {
        version.number = version_count - index;
    }
    Ok(versions)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    write_atomic(Path::new(&path), &contents)
}

#[tauri::command]
fn list_document_versions(document_path: String) -> Result<Vec<DocumentVersion>, String> {
    let dir = document_versions_dir(Path::new(&document_path))?;
    read_document_versions(&dir)
}

#[tauri::command]
fn save_document_version(
    document_path: String,
    contents: String,
) -> Result<SaveVersionResult, String> {
    let dir = document_versions_dir(Path::new(&document_path))?;
    save_document_version_in_dir(&dir, &contents)
}

fn save_document_version_in_dir(dir: &Path, contents: &str) -> Result<SaveVersionResult, String> {
    let versions = read_document_versions(dir)?;

    if let Some(latest) = versions.first() {
        let latest_path = dir.join(&latest.id);
        if fs::read_to_string(latest_path).map_err(|error| error.to_string())? == contents {
            return Ok(SaveVersionResult {
                created: false,
                version: latest.clone(),
            });
        }
    }

    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let path = unique_version_path(&dir);
    write_atomic(&path, &contents)?;
    let id = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| "Could not name version".to_string())?;
    let version = DocumentVersion {
        number: versions.len() + 1,
        created_ms: version_created_ms(&id).unwrap_or(modified_ms(&path)?),
        id,
    };

    Ok(SaveVersionResult {
        created: true,
        version,
    })
}

#[tauri::command]
fn read_document_version(document_path: String, version_id: String) -> Result<String, String> {
    let path = checked_version_path(Path::new(&document_path), &version_id)?;
    if !path.is_file() {
        return Err("Version not found".to_string());
    }
    fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_document_version(
    document_path: String,
    version_id: String,
) -> Result<Vec<DocumentVersion>, String> {
    let dir = document_versions_dir(Path::new(&document_path))?;
    delete_document_version_in_dir(&dir, &version_id, |path| {
        trash::delete(path).map_err(|error| error.to_string())
    })
}

fn delete_document_version_in_dir(
    dir: &Path,
    version_id: &str,
    delete: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<Vec<DocumentVersion>, String> {
    let path = checked_version_path_in_dir(dir, version_id)?;
    if !path.is_file() {
        return Err("Version not found".to_string());
    }

    delete(&path)?;
    read_document_versions(dir)
}

#[tauri::command]
fn list_vault_documents() -> Result<Vec<VaultDocument>, String> {
    let dir = ensure_vault_exists()?;
    read_vault_documents(&dir)
}

#[tauri::command]
fn search_vault_documents(
    query: String,
    current_path: Option<String>,
    current_text: String,
) -> Result<Vec<VaultDocument>, String> {
    let dir = ensure_vault_exists()?;
    let documents = read_vault_documents(&dir)?;
    let query = query.to_lowercase();

    if query.is_empty() {
        return Ok(documents);
    }

    documents
        .into_iter()
        .filter_map(|document| {
            let text = if current_path.as_deref() == Some(document.path.as_str()) {
                current_text.clone()
            } else {
                match fs::read(&document.path) {
                    Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
                    Err(error) => return Some(Err(error.to_string())),
                }
            };

            text.to_lowercase().contains(&query).then_some(Ok(document))
        })
        .collect()
}

fn read_vault_documents(dir: &Path) -> Result<Vec<VaultDocument>, String> {
    let pins = read_pins(dir)?;
    let mut documents = Vec::new();

    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if !is_vault_text_file(&path) {
            continue;
        }

        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let pinned = pins.contains(&name);

        documents.push(VaultDocument {
            created_ms: created_ms(&path, &name)?,
            name,
            path: path.to_string_lossy().into_owned(),
            preview: file_preview(&path)?,
            pinned,
        });
    }

    documents.sort_by(|left, right| {
        right
            .pinned
            .cmp(&left.pinned)
            .then(right.created_ms.cmp(&left.created_ms))
    });
    Ok(documents)
}

#[tauri::command]
fn most_recent_vault_document() -> Result<Option<String>, String> {
    Ok(list_vault_documents()?
        .into_iter()
        .max_by_key(|document| document.created_ms)
        .map(|document| document.path))
}

#[tauri::command]
fn peek_most_recent_vault_document() -> Result<Option<String>, String> {
    let dir = vault_dir()?;
    if !dir.is_dir() {
        return Ok(None);
    }

    Ok(read_vault_documents(&dir)?
        .into_iter()
        .max_by_key(|document| document.created_ms)
        .map(|document| document.path))
}

#[tauri::command]
fn create_vault_document() -> Result<String, String> {
    let dir = ensure_vault_exists()?;
    let path = unique_vault_path(&dir);
    write_atomic(&path, "")?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_vault_document(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    let dir = ensure_vault_exists()?;
    delete_vault_document_from_dir(&path, &dir, |target| {
        trash::delete(target).map_err(|error| error.to_string())
    })
}

fn delete_vault_document_from_dir(
    path: &Path,
    dir: &Path,
    mut delete: impl FnMut(&Path) -> Result<(), String>,
) -> Result<(), String> {
    let stem = vault_document_stem_in_dir(path, dir)?;
    let name = vault_file_name(path)?;
    let images_dir = dir.join(ATTACHMENTS_DIR_NAME).join(&stem);
    let versions_dir = dir.join(VERSIONS_DIR_NAME).join(stem);

    if images_dir.is_dir() {
        delete(&images_dir)?;
    }

    if versions_dir.is_dir() {
        delete(&versions_dir)?;
    }

    if path.exists() {
        delete(path)?;
    }

    let mut pins = read_pins(dir)?;
    if pins.remove(&name) {
        write_pins(dir, &pins)?;
    }

    Ok(())
}

#[tauri::command]
fn list_document_images(document_path: String) -> Result<Vec<DocumentImage>, String> {
    let dir = document_images_dir(Path::new(&document_path))?;
    read_document_images(&dir)
}

#[tauri::command]
fn add_document_images(
    document_path: String,
    source_paths: Vec<String>,
) -> Result<Vec<DocumentImage>, String> {
    let dir = document_images_dir(Path::new(&document_path))?;

    for source_path in source_paths {
        let source = PathBuf::from(source_path);
        if !source.is_file() {
            return Err("Image file not found".to_string());
        }
        store_document_image(&dir, &source, |temp| {
            fs::copy(&source, temp)
                .map(|_| ())
                .map_err(|error| error.to_string())
        })?;
    }

    read_document_images(&dir)
}

#[tauri::command]
fn add_document_image_bytes(
    document_path: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<Vec<DocumentImage>, String> {
    if bytes.is_empty() || bytes.len() > MAX_PASTED_IMAGE_BYTES {
        return Err("Image must be between 1 byte and 20 MB".to_string());
    }

    let source_name = PathBuf::from(file_name);
    let dir = document_images_dir(Path::new(&document_path))?;
    store_document_image(&dir, &source_name, |temp| {
        fs::write(temp, bytes).map_err(|error| error.to_string())
    })?;
    read_document_images(&dir)
}

#[tauri::command]
fn delete_document_image(document_path: String, image_path: String) -> Result<(), String> {
    let document_path = PathBuf::from(document_path);
    let image = checked_document_image(&document_path, Path::new(&image_path))?;
    trash::delete(&image).map_err(|error| error.to_string())?;

    let dir = document_images_dir(&document_path)?;
    if dir
        .read_dir()
        .map_err(|error| error.to_string())?
        .next()
        .is_none()
    {
        fs::remove_dir(&dir).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn reveal_document_images(document_path: String) -> Result<(), String> {
    let dir = document_images_dir(Path::new(&document_path))?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = dir;
        Err("Reveal in Finder is only supported on macOS".to_string())
    }
}

#[tauri::command]
fn toggle_vault_document_pin(path: String) -> Result<bool, String> {
    let path = PathBuf::from(path);

    if !is_vault_path(&path)? || !is_vault_text_file(&path) {
        return Err("Not a vault document".to_string());
    }

    let name = vault_file_name(&path)?;
    let dir = ensure_vault_exists()?;
    let mut pins = read_pins(&dir)?;
    let pinned = if pins.remove(&name) {
        false
    } else {
        pins.insert(name);
        true
    };
    write_pins(&dir, &pins)?;
    Ok(pinned)
}

#[tauri::command]
fn reveal_vault_in_finder() -> Result<(), String> {
    let dir = ensure_vault_exists()?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = dir;
        return Err("Reveal in Finder is only supported on macOS".to_string());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            list_document_versions,
            save_document_version,
            read_document_version,
            delete_document_version,
            list_vault_documents,
            search_vault_documents,
            most_recent_vault_document,
            peek_most_recent_vault_document,
            create_vault_document,
            delete_vault_document,
            toggle_vault_document_pin,
            reveal_vault_in_finder,
            list_document_images,
            add_document_images,
            add_document_image_bytes,
            delete_document_image,
            reveal_document_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static NEXT_TEST_DIR: AtomicU64 = AtomicU64::new(0);

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(name: &str) -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("test clock should follow the Unix epoch")
                .as_nanos();
            let sequence = NEXT_TEST_DIR.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "kens-editor-{name}-{}-{nonce}-{sequence}",
                std::process::id()
            ));
            fs::create_dir_all(&path).expect("test directory should be created");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn saves_first_version_and_refuses_duplicate() {
        let dir = TestDir::new("save-version");

        let first =
            save_document_version_in_dir(dir.path(), "first").expect("first version should save");
        assert!(first.created);
        assert_eq!(first.version.number, 1);
        assert_eq!(
            fs::read_to_string(dir.path().join(&first.version.id))
                .expect("saved version should be readable"),
            "first"
        );

        let duplicate = save_document_version_in_dir(dir.path(), "first")
            .expect("duplicate check should succeed");
        assert!(!duplicate.created);
        assert_eq!(duplicate.version.id, first.version.id);
        assert_eq!(read_document_versions(dir.path()).unwrap().len(), 1);
    }

    #[test]
    fn saved_versions_keep_stable_order_and_numbers() {
        let dir = TestDir::new("version-order");
        let first = save_document_version_in_dir(dir.path(), "first").unwrap();
        let second = save_document_version_in_dir(dir.path(), "second").unwrap();

        let versions = read_document_versions(dir.path()).unwrap();
        assert_eq!(versions.len(), 2);
        assert_eq!(versions[0].id, second.version.id);
        assert_eq!(versions[0].number, 2);
        assert_eq!(versions[1].id, first.version.id);
        assert_eq!(versions[1].number, 1);
    }

    #[test]
    fn deleting_a_version_returns_the_renumbered_catalog() {
        let dir = TestDir::new("delete-one-version");
        let first = save_document_version_in_dir(dir.path(), "first").unwrap();
        let second = save_document_version_in_dir(dir.path(), "second").unwrap();

        let versions = delete_document_version_in_dir(dir.path(), &first.version.id, |path| {
            fs::remove_file(path).map_err(|error| error.to_string())
        })
        .unwrap();

        assert!(!dir.path().join(first.version.id).exists());
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0].id, second.version.id);
        assert_eq!(versions[0].number, 1);
    }

    #[test]
    fn version_order_uses_id_to_break_timestamp_ties() {
        let dir = TestDir::new("version-tie");
        let older = "2026-08-07_120000_001.txt";
        let tied_first = "2026-08-07_120000_002.txt";
        let tied_second = "2026-08-07_120000_002_2.txt";
        fs::write(dir.path().join(older), "older").unwrap();
        fs::write(dir.path().join(tied_first), "first").unwrap();
        fs::write(dir.path().join(tied_second), "second").unwrap();

        let versions = read_document_versions(dir.path()).unwrap();
        assert_eq!(versions[0].id, tied_second);
        assert_eq!(versions[1].id, tied_first);
        assert_eq!(versions[2].id, older);
        assert_eq!(
            versions
                .iter()
                .map(|version| version.number)
                .collect::<Vec<_>>(),
            vec![3, 2, 1]
        );
    }

    #[test]
    fn same_millisecond_version_names_do_not_collide() {
        let dir = TestDir::new("version-collision");
        let stamp = "2026-08-07_120000_123";
        let first = unique_version_path_with_stamp(dir.path(), stamp);
        fs::write(&first, "first").unwrap();
        let second = unique_version_path_with_stamp(dir.path(), stamp);

        assert_eq!(first.file_name().unwrap(), "2026-08-07_120000_123.txt");
        assert_eq!(second.file_name().unwrap(), "2026-08-07_120000_123_2.txt");
    }

    #[test]
    fn rejects_version_ids_that_can_escape_the_version_directory() {
        let document = Path::new("unused.txt");

        for id in [
            "../version.txt",
            "folder/version.txt",
            "/tmp/version.txt",
            "version.md",
        ] {
            assert_eq!(
                checked_version_path(document, id).unwrap_err(),
                "Invalid version"
            );
        }
    }

    #[test]
    fn rejects_documents_outside_the_vault() {
        let vault = TestDir::new("vault");
        let outside = TestDir::new("outside-vault");
        let document = outside.path().join("note.txt");
        fs::write(&document, "text").unwrap();

        let error = delete_vault_document_from_dir(&document, vault.path(), |_| {
            panic!("an outside document must not be deleted")
        })
        .unwrap_err();

        assert_eq!(error, "Not a vault document");
        assert!(document.exists());
    }

    #[test]
    fn deleting_a_document_removes_its_versions() {
        let vault = TestDir::new("delete-version");
        let document = vault.path().join("note.txt");
        let versions = vault.path().join(VERSIONS_DIR_NAME).join("note");
        fs::write(&document, "current").unwrap();
        fs::create_dir_all(&versions).unwrap();
        fs::write(versions.join("2026-08-07_120000_001.txt"), "saved").unwrap();

        delete_vault_document_from_dir(&document, vault.path(), |target| {
            if target.is_dir() {
                fs::remove_dir_all(target).map_err(|error| error.to_string())
            } else {
                fs::remove_file(target).map_err(|error| error.to_string())
            }
        })
        .unwrap();

        assert!(!document.exists());
        assert!(!versions.exists());
    }
}
