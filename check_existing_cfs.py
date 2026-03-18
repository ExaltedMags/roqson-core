import roqson
import json

cfs = roqson.list_docs('Custom Field', ['name', 'dt', 'fieldname'])
print(f"Total Custom Fields on staging: {len(cfs)}")
for cf in cfs[:20]:
    print(f"{cf.get('name')} | {cf.get('dt')} | {cf.get('fieldname')}")
