#!/usr/bin/env python3
"""Passively restore archived synthetic source OUTSIDE the CMG checkout."""
import argparse
from pathlib import Path
import hashlib,json

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args()
    base=Path(__file__).resolve().parent
    repo=base.parents[2]
    destination=Path(args.destination).expanduser().resolve()
    if destination==repo or repo in destination.parents:
        parser.error('Choose a directory outside the CMG checkout.')
    if destination.exists() and (not destination.is_dir() or any(destination.iterdir())):
        parser.error('Destination must be a NEW or EMPTY directory.')
    source=base/'source'
    hashes=json.loads((source/'SHA256SUMS.json').read_text())
    items=[]
    for relative,expected in sorted(hashes.items()):
        p=source/(relative+'.txt')
        if p.is_symlink() or not p.is_file():
            parser.error('Missing or symlink source: '+relative)
        content=p.read_bytes()
        if hashlib.sha256(content).hexdigest()!=expected:
            parser.error('Source checksum mismatch: '+relative)
        target=(destination/relative).resolve()
        if destination not in target.parents:
            parser.error('Invalid archived path.')
        items.append((target,content))
    if not args.dry_run:
        destination.mkdir(parents=True,exist_ok=True)
        for target,content in items:
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(content)
    print(('Validated' if args.dry_run else 'Restored')+' '+str(len(items))+' synthetic-source files; no commands executed.')

if __name__=='__main__':
    main()
