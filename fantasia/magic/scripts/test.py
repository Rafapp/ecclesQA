import sys
import os
import datetime

print("=" * 44)
print("  Magic — Hello World")
print("=" * 44)
print(f"  Time   : {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  Python : {sys.version.split()[0]}")
print(f"  Folder : {os.getcwd()}")
print("=" * 44)
print("  Script ran successfully.")
