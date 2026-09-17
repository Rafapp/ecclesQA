import sys

import magic_runner as runner
from accessibility_workflow import run_workflow


if len(sys.argv) != 3:
    runner.run_error("Expected a source folder and an output folder.")

run_workflow("xlsx", sys.argv[1], sys.argv[2])
