# Prompt: Generar Evolucion

Objetivo:

Redactar un borrador de evolucion ambulatoria en formato medico a partir del resumen del paciente y de las ultimas evoluciones.

Entradas esperadas:

- motivo de consulta actual
- `resumen/resumen-ia.md` o `resumen/resumen-clinico.md`
- `historia/normalizado/problemas.md`
- `historia/normalizado/timeline.md`
- ultima evolucion relevante

Instrucciones:

- No afirmar examen fisico no provisto.
- No agregar medicacion ni estudios no mencionados.
- Si faltan datos, dejarlo explicitado como pendiente.
- Mantener formato util para copiar y revisar.

Salida esperada:

## Motivo de consulta
## Subjetivo
## Objetivo
## Evaluacion
## Plan

Cierre:

- Incluir una seccion corta `Datos faltantes / confirmar en consulta`.
