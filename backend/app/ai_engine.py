import os
import json
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Load environment variables
load_dotenv()

API_KEY = os.getenv("DEEPSEEK_API_KEY")
if not API_KEY:
    print("Warning: DEEPSEEK_API_KEY not found in environment variables.")

# Configure DeepSeek (OpenAI Compatible)
client = AsyncOpenAI(
    api_key=API_KEY,
    base_url="https://api.deepseek.com"
)

class AIEngine:
    def __init__(self, model_name: str = "deepseek-chat"):
        self.model_name = model_name
        self.system_instruction = "You are an expert HR consultant and professional resume writer. Your goal is to help users complete their resume data structure with professional, concise, and impactful language. You must always return valid JSON."

    async def generate_completion(
        self, 
        record_data: Dict[str, Any], 
        target_fields: List[str], 
        user_prompt: str = ""
    ) -> Dict[str, str]:
        """
        Generates content for specific fields based on existing record data and user instructions.
        """
        
        # Helper to handle datetime objects for JSON serialization
        def json_serial(obj):
            if hasattr(obj, 'isoformat'):
                return obj.isoformat()
            return str(obj)

        try:
            # Safe serialization of record data
            context_str = json.dumps(record_data, ensure_ascii=False, indent=2, default=json_serial)
            fields_str = json.dumps(target_fields, ensure_ascii=False)

            user_message = f"""
            # Context
            You are analyzing a structured resume data record:
            {context_str}

            # Task
            Please generate content for the following fields: {fields_str}.
            
            # Important Rules
            1. For simple fields (e.g., "summary"), return the string value.
            2. If "projects" is listed in target fields, you must return the COMPLETE "projects" list. Iterate through each project in the context, fill in any missing or empty fields (like description, role) based on the project title and person's background, and keep existing valid data unchanged.
            3. Do NOT invent projects that are not in the source list. Only enrich the existing ones.

            # User Instruction
            {user_prompt if user_prompt else "Please fill the missing fields professionally based on the context provided above. Infer missing details logically but remain truthful to the provided context."}

            # Output Format
            Return ONLY a valid JSON object.
            """

            response = await client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": self.system_instruction},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                response_format={ "type": "json_object" }
            )

            content = response.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            print(f"AI Generation Error: {e}")
            return {"error": str(e)}

# Singleton instance
ai_engine = AIEngine()