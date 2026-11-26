import os

# Se ejecuta antes de importar la aplicación: una variable de entorno tiene prioridad
# sobre ai-service/.env, así ninguna prueba llama a Gemini con una clave real.
os.environ["GEMINI_API_KEY"] = ""
