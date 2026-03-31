---
type: dashboard
last_updated: 2026-03-15
tags: [meta, dashboard]
---

# MedVault — Panel de Control

> Vault médico personal. Gestionado por agente de IA.
> Ubicación: `/home/jutopa/MedVault/`

---

## Acceso rápido

### Agenda
- [[agenda/daily/2026-03-15|Nota de hoy (2026-03-15)]]
- [[agenda/weekly/2026-W11|Resumen de esta semana]]

### Secciones principales
- [[pacientes/_index|Índice de pacientes]]
- [[administrativo/obras-sociales/pami|PAMI — procedimientos]]
- [[recursos/consultorios|Mis consultorios]]
- [[recursos/contactos|Contactos profesionales]]
- [[AGENT_GUIDE|Guía del agente]]

---

## Comandos de uso frecuente

| Tarea                        | Comando                                                    |
|------------------------------|------------------------------------------------------------|
| Ver agenda de hoy            | `./vault.sh agenda today`                                  |
| Tareas de hoy                | `./vault.sh tasks due today`                               |
| Todas las tareas pendientes  | `./vault.sh tasks pending`                                 |
| Nuevo paciente               | `./vault.sh new patient "Apellido Nombre" "dob" "os"`      |
| Buscar paciente              | `./vault.sh patient search "apellido"`                     |
| Buscar en el vault           | `./vault.sh search "keyword"`                              |
| Crear nota del día           | `./vault.sh init day`                                      |
| Estadísticas                 | `./vault.sh stats`                                         |
| Verificar links              | `./vault.sh lint`                                          |
| Respaldo                     | `tar -czf ~/backup-medvault-$(date +%Y%m%d).tar.gz ~/MedVault/` |

---

## Notas recientes

<!-- El agente puede actualizar esta sección -->

---

## Estructura del vault

```
MedVault/
├── agenda/daily/        Notas diarias (YYYY-MM-DD.md)
├── agenda/weekly/       Resúmenes semanales
├── agenda/guardias/     Turnos de guardia
├── pacientes/           Historias clínicas y evoluciones
├── reuniones/           Ateneos, congresos, reuniones de servicio
├── administrativo/      Tareas, recetas, obras sociales
├── formacion/           Cursos, congresos, bibliografía
└── recursos/            Consultorios, contactos, referencias
```
