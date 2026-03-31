---
type: readme
section: residentes
updated: 2026-03-16
tags: [posadas, residentes, jefatura]
---

# Residentes — Hospital Posadas, Neurología

Área de gestión de la residencia de neurología. Jefe de Residentes.

## Estructura

```
residentes/
├── pase-de-sala/        # YYYY-MM-DD_pase.md — una por día hábil
├── residentes/          # Una ficha por residente (residente-nombre.md)
└── administrativo/      # Tareas de jefatura, planillas, informes
```

## Comandos útiles

```bash
# Crear pase de hoy
./vault.sh pase hoy

# Ver pase de hoy
./vault.sh pase ver

# Listar fichas de residentes
./vault.sh residentes
```

## Residentes activos

| Nombre | Año | Guardia este mes |
|--------|-----|-----------------|
| — | — | — |

## Pendientes administrativos recurrentes

- [ ] Planilla de guardias mensual
- [ ] Informe de actividad de residentes
- [ ] Reunión de residentes semanal
