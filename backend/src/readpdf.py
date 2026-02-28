from PIL import Image
from PyPDF2 import PdfReader
from datetime import datetime
from pdf2image import convert_from_path
import pytesseract
import pandas as pd
from io import StringIO
import os
import re
import fitz
from difflib import SequenceMatcher
from openpyxl import load_workbook
from langdetect import detect

"""
Para detectar el idioma de un fichero
"""


def detectar_idioma(texto):
    return detect(texto)


"""
Para obtener los metadatos de un fichero
"""


def extraer_metadatos(ruta):
    ext = ruta.lower().split(".")[-1]

    if ext == "pdf":
        reader = PdfReader(ruta)
        metadata = reader.metadata
        raw_date = metadata.get("/CreationDate")

        # Intentar extraer la fecha del PDF
        try:
            if raw_date:
                # Quitamos caracteres no numéricos y tomamos los primeros 14 (YYYYMMDDHHMMSS)
                clean_date = re.sub(r"[^0-9]", "", raw_date)[:14]
                fecha = datetime.strptime(clean_date, "%Y%m%d%H%M%S")
            else:
                fecha = datetime.now()
        except:
            fecha = datetime.now()

        # FORMATO CORRECTO PARA OPENSEARCH: 2021-05-12
        return {
            "autor": metadata.get("/Author")
            if metadata.get("/Author")
            else "Desconocido",
            "creation_date": fecha.strftime("%Y-%m-%d"),
        }

    elif ext == "xlsx":
        wb = load_workbook(ruta)
        # Aseguramos formato ISO
        fecha_excel = wb.properties.created if wb.properties.created else datetime.now()
        return {
            "autor": wb.properties.creator if wb.properties.creator else "Desconocido",
            "creation_date": fecha_excel.strftime("%Y-%m-%d"),
        }

    elif ext in ["csv", "txt"]:
        stat = os.stat(ruta)
        fecha_sistema = datetime.fromtimestamp(stat.st_ctime)
        return {"autor": "Sistema", "creation_date": fecha_sistema.strftime("%Y-%m-%d")}

    else:
        return {"Error": "Formato no soportado"}


"""
Obtenemos el texto de cada pagina en lineas. paginas sera una lista de listas de lineas
"""


def extraer_paginas(ruta_pdf):
    doc = fitz.open(ruta_pdf)
    paginas = []
    for page in doc:
        texto = page.get_text()
        lineas = texto.split("\n")
        paginas.append(lineas)
    doc.close()
    return paginas


"""
Devuelve True o False si dos textos son lo suficientemente similares
"""


def son_similares(a, b, umbral=0.7):
    return SequenceMatcher(None, a, b).ratio() >= umbral


"""
Detecta líneas casi repetidas en top o bottom de las páginas.
"""


def detectar_casi_repetidos(paginas, posicion="top", n_lineas=3):
    lineas = []

    # 1️⃣ Recoger líneas candidatas
    for pagina in paginas:
        if posicion == "top":
            candidatas = pagina[:n_lineas]
        else:
            candidatas = pagina[-n_lineas:]

        for linea in candidatas:
            lineas.append(linea.strip())

    grupos = []
    usadas = set()

    # 2️⃣ Agrupar por similitud
    for i in range(len(lineas)):
        if i in usadas:
            continue

        grupo_actual = [lineas[i]]
        usadas.add(i)

        for j in range(i + 1, len(lineas)):
            if j in usadas:
                continue

            if son_similares(lineas[i], lineas[j]):
                grupo_actual.append(lineas[j])
                usadas.add(j)

        grupos.append(grupo_actual)

    # 3️⃣ Ver qué grupos superan el umbral del 80%
    umbral = len(paginas) * 0.6
    repetidos = set()

    for grupo in grupos:
        if len(grupo) >= umbral:
            for linea in grupo:
                repetidos.add(linea)

    return repetidos


"""
Elimina de cada página las líneas que se repiten en la parte superior
(headers) o inferior (footers) del documento. Devuelve todo el texto limpio
en un unico string
"""


def limpiar_headers_footers(paginas):
    # Detectamos las líneas repetidas arriba y abajo
    headers = detectar_casi_repetidos(paginas, "top")
    footers = detectar_casi_repetidos(paginas, "bottom")

    texto_limpio = []

    # Recorremos cada página
    for pagina in paginas:
        lineas_filtradas = []

        # Recorremos cada línea de la página
        for linea in pagina:
            # Si la línea es un header repetido, la saltamos
            if linea in headers:
                continue

            # Si la línea es un footer repetido, la saltamos
            if linea in footers:
                continue

            # Si no es ni header ni footer, la guardamos
            lineas_filtradas.append(linea)

        # Unimos las líneas limpias de la página
        pagina_limpia = "\n".join(lineas_filtradas)
        texto_limpio.append(pagina_limpia)

    # Unimos todas las páginas en un único texto
    resultado_final = "\n".join(texto_limpio)

    return resultado_final


"""
Para normalizar los espacios del texto, se hace basicamente lo que se dice en los comentarios
"""


def normalizar_espacios(texto):
    # Reemplazar tabs por espacio
    texto = texto.replace("\t", " ")

    # Quitar espacios múltiples
    texto = re.sub(r"[ ]{2,}", " ", texto)

    # Quitar espacios antes de salto de línea
    texto = re.sub(r" +\n", "\n", texto)

    # Quitar espacios al inicio y final
    texto = texto.strip()

    return texto


"""
Une todo el texto en un solo párrafo limpio:
- Elimina caracteres especiales tipo •, ★, etc.
- Respeta signos de puntuación normales (. , : ; ? !)
- Convierte saltos de línea en espacios
"""


def unir_lineas(texto):
    # Quitar caracteres especiales (excepto letras, números, puntuación normal y espacios)
    texto = re.sub(r"[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ@%/+-=#_.,:;?!\s]", "", texto)

    # Reemplazar saltos de línea y tabs por espacio
    texto = texto.replace("\n", " ").replace("\t", " ")

    # Reducir múltiples espacios a uno solo
    texto = re.sub(r" +", " ", texto)

    # Quitar espacios al inicio y al final
    texto = texto.strip()

    return texto


"""
Devuelve una lista de listas de lineas (cada lista corresponde a una pagina)
"""


def extraer_lineas_pdf(ruta_pdf, idioma="spa"):
    # 1️⃣ Convertir el PDF en imágenes (una imagen por página)
    paginas = convert_from_path(ruta_pdf)

    # 2️⃣ Lista final que contendrá todas las páginas
    lista_listas_paginas = []

    # 3️⃣ Procesar cada página
    for pagina in paginas:
        # Aplicar OCR a la imagen de la página
        texto = pytesseract.image_to_string(pagina, lang=idioma)

        # Separar el texto en líneas y eliminar líneas vacías
        lineas = []
        for linea in texto.splitlines():
            linea = linea.strip()  # Quitar espacios al inicio y final
            if linea:  # Solo añadir si no está vacía
                lineas.append(linea)

        # Añadir las líneas de esta página a la lista final
        lista_listas_paginas.append(lineas)

    return lista_listas_paginas


"""
Funcion general que realizara todo el proceso llamando a otras funciones
"""


def limpiar(ruta):
    # Revisamos la extension del fichero
    ext = os.path.splitext(ruta)[1].lower()

    diccionario = {}

    diccionario = extraer_metadatos(ruta)

    if ext == ".pdf":
        # Esto es lo que hay que hacer con un PDF normal
        paginas = extraer_paginas(ruta)

        texto = limpiar_headers_footers(paginas)
        texto = normalizar_espacios(texto)
        texto = unir_lineas(texto)

        if not texto:
            paginas = extraer_lineas_pdf(ruta)

            texto = limpiar_headers_footers(paginas)
            texto = normalizar_espacios(texto)
            texto = unir_lineas(texto)

    elif ext in [".txt", ".csv", ".xlsx"]:
        if ext == ".xlsx":
            # Cargar la primera hoja del Excel
            df = pd.read_excel(ruta)

            # Convertir a CSV en memoria
            csv_buffer = StringIO()
            df.to_csv(csv_buffer, index=False, encoding="utf-8")

            # Obtener el contenido como texto
            texto = csv_buffer.getvalue()
        else:
            # TXT o CSV
            with open(ruta, "r", encoding="utf-8") as f:
                texto = f.read()

        # Procesar el texto
        texto = normalizar_espacios(texto)
        texto = unir_lineas(texto)

    else:
        raise ValueError("No se ha definido logica para esta extension de fichero")

    idioma = detectar_idioma(texto)

    diccionario["lang"] = idioma
    diccionario["text"] = texto

    return diccionario


if __name__ == "__main__":
    ruta = "dataset_hackudc/presupuesto_2025_novatech.xlsx"
    texto_limpio = limpiar(ruta)

    print(texto_limpio)
