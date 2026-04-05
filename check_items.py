import xml.etree.ElementTree as ET
import os
import re
import sys
import string

if len(sys.argv) < 2:
    print("usage: check_items.py <xml_file>")
    exit(1)

filepath = sys.argv[1]

with open(filepath) as f:
    data = f.read()

data = re.sub(f'[^{re.escape(string.printable)}]', '', data)

root = ET.fromstring(data)

comparisons = root.findall('COMPARISONS/NODE')
setup = root.findall('INITIALSETUP/NODE')


def build_path_dict(nodes, path='', d=None):
    """Build a dict mapping node path -> {nodeValue, checkType, name}."""
    if d is None:
        d = {}
    for node in nodes:
        name_el = node.find('NAME')
        id_el = node.find('ID')
        nid = (id_el.text or '') if id_el is not None else ''
        current_path = path + '/' + nid
        if name_el is not None:
            d[current_path] = {
                'nodeValue': name_el.attrib.get('nodeValue', ''),
                'checkType': name_el.attrib.get('checkType', '0'),
                'name': name_el.text or '',
            }
        children = node.findall('NODE')
        if children:
            build_path_dict(children, current_path, d)
    return d


setup_dict = build_path_dict(setup)
comp_dict = build_path_dict(comparisons)

# Collect all check items (checkType 1 or 2) from COMPARISONS and compare with
# the corresponding INITIALSETUP node to identify incorrect vs correct values.
check_items = []
for path, comp_info in comp_dict.items():
    if comp_info['checkType'] not in ('1', '2'):
        continue
    setup_info = setup_dict.get(path)
    initial_val = setup_info['nodeValue'] if setup_info else None
    expected_val = comp_info['nodeValue']
    if initial_val is not None:
        match = initial_val == expected_val
    else:
        match = None
    check_items.append({
        'path': path,
        'name': comp_info['name'],
        'checkType': comp_info['checkType'],
        'incorrect': initial_val,
        'correct': expected_val,
        'match': match,
    })

total = len(check_items)
in_both = sum(1 for x in check_items if x['incorrect'] is not None)
correct_count = sum(1 for x in check_items if x['match'] is True)
incorrect_count = sum(1 for x in check_items if x['match'] is False)
missing_count = sum(1 for x in check_items if x['incorrect'] is None)

print(f"=== Check Items Report for {os.path.basename(filepath)} ===")
print()
print(f"Total check items (checkType 1 or 2): {total}")
print(f"  Already correct (initial == expected): {correct_count}")
print(f"  Incorrect (initial != expected):        {incorrect_count}")
print(f"  Not in initial setup (new items):       {missing_count}")
print()

print("--- Items that need to be configured (incorrect initial vs correct expected) ---")
print()
for item in check_items:
    if item['match'] is False:
        print(f"Path:      {item['path']}")
        print(f"Name:      {item['name']}")
        print(f"INCORRECT: {item['incorrect']}")
        print(f"CORRECT:   {item['correct']}")
        print()

print("--- Items already correct ---")
print()
for item in check_items:
    if item['match'] is True:
        print(f"Path:      {item['path']}")
        print(f"Name:      {item['name']}")
        print(f"Value:     {item['correct']}")
        print()

if missing_count > 0:
    print("--- Items only in COMPARISONS (not in initial setup) ---")
    print()
    for item in check_items:
        if item['match'] is None:
            print(f"Path:      {item['path']}")
            print(f"Name:      {item['name']}")
            print(f"CORRECT:   {item['correct']}")
            print()
