import shutil
from pathlib import Path

from app.models.schemas import FileAudit
from app.services.paths import get_container_storage_root, relative_to_input_root, to_host_storage_path


def archive_original_file(source_file: Path, audit: FileAudit) -> str:
    if not source_file.exists():
        raise FileNotFoundError(str(source_file))

    relative_path = relative_to_input_root(source_file)
    storage_root = get_container_storage_root()
    target_path = storage_root / "casos" / relative_path
    target_path.parent.mkdir(parents=True, exist_ok=True)

    if not target_path.exists() or target_path.stat().st_size != source_file.stat().st_size:
        shutil.copy2(source_file, target_path)

    return to_host_storage_path(target_path)
