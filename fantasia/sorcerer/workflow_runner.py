"""Run a Magic workflow with its scripts directory on the embedded Python path."""
import runpy
import sys
from pathlib import Path


scripts_dir = Path(sys.argv[1]).resolve()
script_path = Path(sys.argv[2]).resolve()
sys.path.insert(0, str(scripts_dir))
sys.argv = [str(script_path), *sys.argv[3:]]
runpy.run_path(str(script_path), run_name="__main__")
