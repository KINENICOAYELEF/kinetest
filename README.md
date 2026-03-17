# Kine Poli App

Monorepo para la aplicación PWA de preguntas adaptativas en kinesiología y la herramienta de ingesta de datos.

## Estructura

- `/apps/web`: Aplicación PWA (React + Vite + TypeScript)
- `/tools/ingest_notebooklm`: Herramienta de ingesta de datos de NotebookLM (Python)
- `/docs`: Documentación general
- `/firebase`: Configuración y reglas de Firebase (Sin Cloud Functions)

## Prerrequisitos

- Node.js (v18+)
- pnpm (última versión)
- Python (3.10+)

## Pasos para ejecutar localmente

1. **Instalar dependencias del monorepo**
   ```bash
   pnpm install
   ```

2. **Levantar la aplicación web**
   ```bash
   npm run dev
   # o bien: pnpm run dev
   ```

3. **Ejecutar herramienta de Python**
   Ir a `/tools/ingest_notebooklm` e instalar los requirements (idealmente dentro de un entorno virtual).
   ```bash
   cd tools/ingest_notebooklm
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python main.py
   ```
4. **Despliegue a Producci\u00f3n (Firebase Hosting)**

Para subir la aplicaci\u00f3n a internet:

1. **Instalar Firebase CLI** (si no lo tienes):
   ```bash
   npm install -g firebase-tools
   ```

2. **Iniciar sesi\u00f3n en Firebase**:
   ```bash
   firebase login
   ```

3. **Construir la aplicaci\u00f3n**:
   ```bash
   # Dentro de la carpeta ra\u00edz
   pnpm run build
   ```

4. **Desplegar**:
   ```bash
   firebase deploy --only hosting
   ```

## Capacidades PWA

La aplicaci\u00f3n est\u00e1 configurada para ser "instalable":

- **iOS (Safari)**: Bot\u00f3n "Compartir" -> "Agregar a pantalla de inicio".
- **Android (Chrome)**: Men\u00fa (tres puntos) -> "Instalar aplicaci\u00f3n" o "Agregar a pantalla principal".
- **Escritorio (Chrome/Edge)**: Icono de "Instalar" en la barra de direcciones.

## Actualizaci\u00f3n de Contenido

Para actualizar las preguntas:
1. Sube los archivos a `tools/ingest_notebooklm/sample_input`.
2. Ejecuta el script `main.py` (aseg\u00farate de tener el `serviceAccountKey.json` configurado).
3. Los cambios se ver\u00e1n reflejados inmediatamente en la aplicaci\u00f3n (tanto local como en producci\u00f3n).
