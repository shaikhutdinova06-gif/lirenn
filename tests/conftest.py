import os
import sys
import tempfile

# Ensure the project root is on sys.path so ``backend`` is importable.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Override DATA_DIR *before* any backend module is imported so that
# storage / auth modules write to a throw-away temp directory instead
# of /data.
_tmp_data = tempfile.mkdtemp(prefix="lirenn_test_")
os.environ["DATA_DIR"] = _tmp_data
