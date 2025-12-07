import re
import zipfile
import io
import xml.etree.ElementTree as ET
from typing import List

def extract_placeholders_in_order(docx_bytes: bytes) -> List[str]:
    """
    Parses word/document.xml from a docx file (in bytes) to extract 
    Jinja2 placeholders {{ ... }} in order.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as zf:
            xml_content = zf.read('word/document.xml')
            root = ET.fromstring(xml_content)
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            # Extract all text from <w:t> tags
            full_text = "".join(node.text for node in root.findall('.//w:t', ns) if node.text)
            
            # Find all {{ ... }} patterns
            found = [p.strip() for p in re.findall(r'\{\{(.*?)\}\}', full_text)]
            
            # Deduplicate while preserving order
            return list(dict.fromkeys(found))
    except Exception as e:
        print(f"Error extracting placeholders: {e}")
        return []
