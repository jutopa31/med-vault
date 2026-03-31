# Prompt: Resumen de Paciente

Objetivo:

Generar un resumen clinico breve, util para consulta ambulatoria, basado solo en la informacion provista.

Entradas esperadas:

- `demografia.md`
- `historia/normalizado/problemas.md`
- `historia/normalizado/timeline.md`
- evoluciones previas relevantes

Instrucciones:

- No inventar diagnosticos ni medicacion.
- Señalar incertidumbre cuando falten datos.
- Priorizar neurologia, comorbilidades, estudios y tratamientos activos.
- Diferenciar hechos de inferencias.
- Mantener tono medico breve.

Salida esperada:

1. Identificacion breve.
2. Problemas activos priorizados.
3. Antecedentes relevantes.
4. Tratamientos actuales.
5. Pendientes / proximos pasos.
6. Riesgos o alertas.
