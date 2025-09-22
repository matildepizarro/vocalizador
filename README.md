# Vocalizer — Versión Matilde (v3)

Mejoras en esta versión:
- Micro-animaciones extra: transiciones suaves al cambiar ejercicios, microfeedback sonoro (click) y ripple en botones.
- Detector de pitch mejorado: se incluyó una implementación simplificada del algoritmo **YIN** (inline). Para uso robusto en producción recomiendo usar bibliotecas probadas como **pitchfinder** o **yinjs** (ambas MIT).

Referencias útiles:
- pitchfinder (compilación de detectores, incluye YIN). GitHub: peterkhayes/pitchfinder. citeturn0search1
- yinjs (implementación JS de YIN). citeturn0search0

## Archivos
- `index.html`, `style.css`, `app.js`, `README.md`, `assets/`

## Uso
Descomprime y abre `index.html` en Chrome/Edge/Firefox. Otorga permiso al micrófono cuando se solicite. Interactúa para activar audio (click) y prueba las microinteracciones.

## Notas técnicas
- La función `yinDetect` es una implementación compacta del algoritmo YIN. Para casos con mucho ruido o demandas de precisión, integrar `pitchfinder` o `yinjs` es recomendable. Fuentes: pitchfinder, yinjs. citeturn0search1turn0search0
- Grabaciones descargables: formato `webm` en Chromium. Persistencia no implementada.

Autora: **Matilde Pizarro Toro**
