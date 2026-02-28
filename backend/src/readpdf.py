import re
import fitz
from difflib import SequenceMatcher

"""
Obtenemos el texto de cada página en líneas. 
Retorna una lista donde cada elemento es una lista de strings (líneas).
"""
def extraer_paginas(ruta_pdf):
    try:
        doc = fitz.open(ruta_pdf)
        paginas = []
        for page in doc:
            texto = page.get_text()
            lineas = texto.split('\n')
            paginas.append(lineas)
        doc.close()
        return paginas
    except Exception as e:
        print(f"Error al abrir el PDF: {e}")
        return []

"""
Compara la similitud entre dos textos (útil para detectar headers repetidos).
"""
def son_similares(a, b, umbral=0.7):
    return SequenceMatcher(None, a, b).ratio() >= umbral

"""
Limpia espacios extraños, tabs y saltos de línea innecesarios.
"""
def normalizar_espacios(texto):
    texto = texto.replace("\t", " ")
    texto = re.sub(r"[ ]{2,}", " ", texto) # Quitar espacios múltiples
    texto = re.sub(r" +\n", "\n", texto)   # Quitar espacios antes de salto de línea
    return texto.strip()

"""
Elimina caracteres especiales y une todo en un flujo de texto continuo.
Esto es vital para que el embedding sea de calidad.
"""
def unir_lineas(texto):
    # Mantener solo caracteres alfanuméricos, puntuación básica y espacios
    texto = re.sub(r"[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ@%/+-=#_.,:;?!\s]", "", texto)
    # Convertir saltos de línea en espacios
    texto = texto.replace("\n", " ").replace("\t", " ")
    # Limpiar espacios múltiples resultantes
    texto = re.sub(r" +", " ", texto)
    return texto.strip()

"""
Detecta y elimina encabezados (headers) y pies de página (footers) 
comparando las primeras y últimas líneas de todas las páginas.
"""
def limpiar_headers_footers(paginas):
    if not paginas:
        return ""
    
    # Si solo hay una página, no podemos comparar repeticiones
    if len(paginas) == 1:
        return "\n".join(paginas[0])

    texto_final = []
    
    # Identificar posibles líneas de header (línea 0 de cada página)
    headers_a_borrar = set()
    primeras_lineas = [p[0] for p in paginas if len(p) > 0]
    
    for i in range(len(primeras_lineas)):
        for j in range(i + 1, len(primeras_lineas)):
            if son_similares(primeras_lineas[i], primeras_lineas[j]):
                headers_a_borrar.add(primeras_lineas[i])

    # Procesar cada página quitando las líneas basura
    for pagina in paginas:
        lineas_validas = []
        for i, linea in enumerate(pagina):
            # Omitir si es header detectado
            if i == 0 and linea in headers_a_borrar:
                continue
            # Omitir líneas que son solo números (posibles números de página)
            if re.match(r"^\s*\d+\s*$", linea):
                continue
            lineas_validas.append(linea)
        
        texto_final.append("\n".join(lineas_validas))

    return "\n".join(texto_final)

"""
Función principal que orquesta la extracción y limpieza completa.
"""
def limpiar_pdf(ruta_pdf):
    # 1. Extraer
    paginas = extraer_paginas(ruta_pdf)
    if not paginas:
        return ""

    # 2. Quitar ruido (headers/footers/números de página)
    texto_sucio = limpiar_headers_footers(paginas)

    # 3. Normalizar espacios
    texto_medio = normalizar_espacios(texto_sucio)

    # 4. Unificar en un solo párrafo limpio para el Chunking
    texto_limpio = unir_lineas(texto_medio)

    return texto_limpio