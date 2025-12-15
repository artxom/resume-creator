import logging
import json
from typing import Dict, List, Any, Optional, Tuple
from openai import AsyncOpenAI

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class AIEngine:
    """
    Core engine for interacting with AI models (DeepSeek, OpenAI, etc.).
    Handles client initialization, OpenRouter specific adaptations, and prompt construction.
    """
    def __init__(self):
        self.system_instruction = "You are an expert HR consultant and professional resume writer. Your goal is to help users complete their resume data structure with professional, concise, and impactful language. You must always return valid JSON."

    def _configure_openrouter_client(self, base_url: str) -> Tuple[str, Dict[str, str]]:
        """
        Helper method to normalize Base URL and headers for OpenRouter.ai.
        """
        headers = {}
        if "openrouter.ai" in base_url:
            # 1. Ensure Base URL points to API endpoint, not website
            if not base_url.endswith("/v1"):
                # Handle cases like "https://openrouter.ai" -> "https://openrouter.ai/api/v1"
                if base_url.endswith("/api"):
                    base_url += "/v1"
                elif "api/v1" not in base_url:
                    base_url = base_url.rstrip("/") + "/api/v1"
            
            # 2. Add required headers for OpenRouter
            headers = {
                "HTTP-Referer": "http://localhost:5173", # Client URL
                "X-Title": "TenderWizard" # App Name
            }
        return base_url, headers

    def _get_client(self, api_config: Optional[Dict[str, str]] = None) -> Tuple[AsyncOpenAI, Optional[str]]:
        """
        Returns an AsyncOpenAI client and the model name based on provided config.
        """
        api_key = None
        base_url = None
        model_name = None

        if api_config:
            api_key = api_config.get("api_key", "").strip()
            base_url = api_config.get("base_url", "").strip()
            model_name = api_config.get("model_name", "").strip()
        
        if not api_key:
            logger.error("No API Key found in configuration.")
            raise ValueError("No AI Configuration found. Please configure an AI model in the 'System Settings' (系统设置) page.")

        # Handle OpenRouter specifics if needed
        base_url, default_headers = self._configure_openrouter_client(base_url)

        client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers=default_headers
        )
        return client, model_name

    async def generate_completion(
        self, 
        record_data: Dict[str, Any], 
        target_fields: List[str], 
        user_prompt: str = "",
        field_instructions: Dict[str, Any] = {},
        model_name: Optional[str] = None,
        api_config: Optional[Dict[str, str]] = None
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
            client, config_model_name = self._get_client(api_config)
            
            # Use passed model_name if available, otherwise use config's model
            target_model = model_name if model_name else config_model_name
            
            if not target_model:
                raise ValueError("Model name is missing in both request and configuration.")

            logger.info(f"Generating content using model: {target_model} for fields: {target_fields}")

            # Safe serialization of record data
            context_str = json.dumps(record_data, ensure_ascii=False, indent=2, default=json_serial)
            fields_str = json.dumps(target_fields, ensure_ascii=False)

            # Construct Field Instructions String
            field_instr_str = ""
            if field_instructions:
                field_instr_str += "\n# Specific Field Instructions\n"
                for field, instr in field_instructions.items():
                    # Only include instructions for fields we are targeting, OR global context fields if useful
                    if field in target_fields or any(t.startswith(field) for t in target_fields):
                         field_instr_str += f"- **{field}**:\n"
                         if isinstance(instr, dict):
                             for k, v in instr.items():
                                 if v: field_instr_str += f"  - {k.capitalize()}: {v}\n"
            
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

            {field_instr_str}

            # Output Format
            Return ONLY a valid JSON object.
            """

            response = await client.chat.completions.create(
                model=target_model,
                messages=[
                    {"role": "system", "content": self.system_instruction},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                response_format={ "type": "json_object" }
            )

            content = response.choices[0].message.content
            logger.info("AI generation successful.")
            return json.loads(content)
            
        except Exception as e:
            logger.exception(f"AI Generation Error: {e}")
            return {"error": str(e)}

# Singleton instance
ai_engine = AIEngine()