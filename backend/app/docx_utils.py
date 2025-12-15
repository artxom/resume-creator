import io
from typing import List
from docxtpl import DocxTemplate

def extract_placeholders_in_order(docx_bytes: bytes) -> List[str]:
    """
    Uses docxtpl to robustly extract Jinja2 placeholders {{ ... }} from a docx file.
    This method is superior to manual XML parsing because it handles:
    1. Split XML tags (common in Word).
    2. Complex Jinja2 syntax.
    3. Consistency with the actual rendering engine.
    """
    try:
        # Load the docx file from bytes
        doc = DocxTemplate(io.BytesIO(docx_bytes))
        
        # docxtpl provides a native method to find all variables that would be needed for rendering
        # This returns a set of keys
        undeclared_vars = doc.get_undeclared_template_variables()
        
        # Convert to sorted list for consistent UI presentation
        return sorted(list(undeclared_vars))
        
    except Exception as e:
        print(f"Error extracting placeholders with docxtpl: {e}")
        return []
