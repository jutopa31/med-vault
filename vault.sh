#!/usr/bin/env bash
# vault.sh — MedVault CLI helper
# Uso: ./vault.sh <comando> [args]
# Ubicación: /home/jutopa/MedVault/vault.sh

set -euo pipefail

VAULT_ROOT="/home/jutopa/MedVault"
TODAY=$(date +%Y-%m-%d)
DOW=$(date +%A)
WEEK=$(date +%Y-W%V)

# ─── Colores ─────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

usage() {
  cat <<EOF
${BOLD}MedVault CLI Helper${RESET}

Uso: ./vault.sh <comando> [args]

${CYAN}Agenda${RESET}
  agenda today                      Ver nota diaria de hoy
  agenda date YYYY-MM-DD            Ver nota de una fecha específica
  agenda week                       Ver resumen semanal

${CYAN}Pacientes${RESET}
  new patient "Apellido Nombre" [YYYY-MM-DD] [obra_social]
                                    Crear carpeta de paciente nuevo
  patient search "keyword"          Buscar en carpetas de pacientes
  patient evolutions "patient_id"   Listar evoluciones de un paciente

${CYAN}Tareas${RESET}
  tasks due today                   Tareas vencidas o de hoy
  tasks due week                    Tareas de esta semana
  tasks pending                     Todas las tareas abiertas
  tasks done "archivo" LINEA        Marcar tarea como completada

${CYAN}Búsqueda${RESET}
  search "keyword"                  Búsqueda completa en el vault
  search type <tipo>                Notas de un tipo específico
  search tag <tag>                  Notas con un tag específico

${CYAN}Residentes / Posadas${RESET}
  pase hoy                          Crear nota de pase de sala de hoy
  pase ver                          Ver el pase de hoy
  pase date YYYY-MM-DD              Ver pase de una fecha específica
  residentes                        Listar fichas de residentes activos

${CYAN}Consultorios${RESET}
  consultorio ospedyc [YYYY-MM-DD]  Ver lista de pacientes Ospedyc
  consultorio pilar [YYYY-MM-DD]    Ver lista de pacientes Pilar

${CYAN}Estadísticas${RESET}
  stats                             Resumen del vault

${CYAN}Mantenimiento${RESET}
  init day                          Crear nota diaria de hoy (si no existe)
  init week                         Crear resumen semanal (si no existe)
  lint                              Verificar links internos rotos
EOF
}

# ─── AGENDA ──────────────────────────────────────────────────────
cmd_agenda() {
  local sub="${1:-today}"
  case "$sub" in
    today)
      local f="$VAULT_ROOT/agenda/daily/$TODAY.md"
      if [[ -f "$f" ]]; then
        echo -e "${BOLD}=== Nota diaria: $TODAY ===${RESET}"
        cat "$f"
      else
        echo -e "${YELLOW}No existe nota para $TODAY. Ejecutar: ./vault.sh init day${RESET}"
      fi
      ;;
    date)
      local d="${2:?Falta la fecha YYYY-MM-DD}"
      local f="$VAULT_ROOT/agenda/daily/$d.md"
      [[ -f "$f" ]] && cat "$f" || echo "No existe nota para $d"
      ;;
    week)
      local f="$VAULT_ROOT/agenda/weekly/$WEEK.md"
      [[ -f "$f" ]] && cat "$f" || echo "No existe resumen para $WEEK. Ejecutar: ./vault.sh init week"
      ;;
    *)
      echo "Subcomando desconocido: $sub" >&2; exit 1 ;;
  esac
}

# ─── NUEVO PACIENTE ──────────────────────────────────────────────
cmd_new_patient() {
  local fullname="${1:?Falta nombre del paciente}"
  local dob="${2:-desconocida}"
  local obra_social="${3:-particular}"

  # Normalizar: "García Carlos" → "garcia-carlos"
  local slug
  slug=$(echo "$fullname" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[áàäâ]/a/g; s/[éèëê]/e/g; s/[íìïî]/i/g; s/[óòöô]/o/g; s/[úùüû]/u/g; s/ñ/n/g; s/ü/u/g' \
    | tr ' ' '-' \
    | tr -cd '[:alnum:]-')

  local dob_slug
  dob_slug=$(echo "$dob" | tr -d '-')
  local patient_id="${slug}_${dob_slug}"
  local folder="$VAULT_ROOT/pacientes/${patient_id}"

  if [[ -d "$folder" ]]; then
    echo -e "${YELLOW}Paciente ya existe: $folder${RESET}"
    exit 0
  fi

  mkdir -p "$folder/evoluciones"

  # Calcular edad aproximada si hay fecha de nacimiento
  local age="null"
  if [[ "$dob" != "desconocida" ]]; then
    local birth_year
    birth_year=$(echo "$dob" | cut -d'-' -f1)
    local current_year
    current_year=$(date +%Y)
    age=$((current_year - birth_year))
  fi

  # Crear historia-clinica desde template
  sed \
    -e "s/{{PATIENT_ID}}/$patient_id/g" \
    -e "s/{{DATE}}/$TODAY/g" \
    -e "s/{{DOB}}/$dob/g" \
    -e "s/{{OBRA_SOCIAL}}/$obra_social/g" \
    -e "s/{{APELLIDO_NOMBRE}}/$fullname/g" \
    -e "s/{{LOCATION}}/consultorio/g" \
    -e "s/{{SEX}}/null/g" \
    -e "s/{{AGE}}/$age/g" \
    "$VAULT_ROOT/_templates/TPL_patient-history.md" \
    > "$folder/historia-clinica.md"

  # Registrar en el índice de pacientes
  local index="$VAULT_ROOT/pacientes/_index.md"
  echo "| $patient_id | $fullname | $dob | $obra_social | $TODAY | [[${patient_id}/historia-clinica\|Historia]] |" \
    >> "$index"

  echo -e "${GREEN}Paciente creado:${RESET} $folder"
  echo -e "  ID: ${BOLD}$patient_id${RESET}"
  echo -e "  Historia: $folder/historia-clinica.md"
}

# ─── TAREAS ──────────────────────────────────────────────────────
cmd_tasks() {
  local sub="${1:-pending}"
  local sub2="${2:-}"

  case "$sub $sub2" in
    "due today")
      echo -e "${BOLD}=== Tareas vencidas o de hoy ($TODAY) ===${RESET}"
      grep -rn -e "- \[ \]" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | while IFS= read -r line; do
            local date_in_task
            date_in_task=$(echo "$line" | grep -oP '📅 \K[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
            if [[ -n "$date_in_task" && ! "$date_in_task" > "$TODAY" ]]; then
              echo "$line" | sed "s|$VAULT_ROOT/||"
            elif [[ -z "$date_in_task" ]]; then
              # Tareas sin fecha también se muestran
              echo "$line" | sed "s|$VAULT_ROOT/||"
            fi
          done
      ;;
    "due week")
      local week_end
      week_end=$(date -d "next sunday" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
      echo -e "${BOLD}=== Tareas hasta $week_end ===${RESET}"
      grep -rn -e "- \[ \]" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | while IFS= read -r line; do
            local date_in_task
            date_in_task=$(echo "$line" | grep -oP '📅 \K[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
            if [[ -n "$date_in_task" && ! "$date_in_task" > "$week_end" ]]; then
              echo "$line" | sed "s|$VAULT_ROOT/||"
            fi
          done
      ;;
    "pending ")
      echo -e "${BOLD}=== Todas las tareas pendientes ===${RESET}"
      grep -rn -e "- \[ \]" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | sed "s|$VAULT_ROOT/||" | sort
      ;;
    "done ")
      echo "Uso: ./vault.sh tasks done \"archivo/relativo.md\" NUMERO_LINEA" >&2
      exit 1
      ;;
    done*)
      local file="$VAULT_ROOT/${2:?Falta archivo relativo}"
      local lineno="${3:?Falta número de línea}"
      if [[ ! -f "$file" ]]; then
        echo -e "${RED}Archivo no encontrado: $file${RESET}" >&2; exit 1
      fi
      sed -i "${lineno}s/- \[ \]/- [x]/" "$file"
      sed -i "${lineno}s/$/ ✅ $TODAY/" "$file"
      echo -e "${GREEN}Tarea marcada como hecha en $file línea $lineno${RESET}"
      ;;
    *)
      # Fallback: mostrar todas las pendientes
      echo -e "${BOLD}=== Todas las tareas pendientes ===${RESET}"
      grep -rn -e "- \[ \]" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | sed "s|$VAULT_ROOT/||" | sort
      ;;
  esac
}

# ─── PASE DE SALA ────────────────────────────────────────────────
cmd_pase() {
  local sub="${1:-ver}"
  case "$sub" in
    hoy)
      local f="$VAULT_ROOT/residentes/pase-de-sala/${TODAY}_pase.md"
      if [[ -f "$f" ]]; then
        echo -e "${YELLOW}Pase de hoy ya existe: $f${RESET}"
      else
        sed \
          -e "s/{{DATE}}/$TODAY/g" \
          "$VAULT_ROOT/_templates/TPL_pase-de-sala.md" > "$f"
        echo -e "${GREEN}Pase creado:${RESET} $f"
      fi
      ;;
    ver)
      local f="$VAULT_ROOT/residentes/pase-de-sala/${TODAY}_pase.md"
      if [[ -f "$f" ]]; then
        echo -e "${BOLD}=== Pase de sala: $TODAY ===${RESET}"
        cat "$f"
      else
        echo -e "${YELLOW}No hay pase para hoy. Ejecutar: ./vault.sh pase hoy${RESET}"
      fi
      ;;
    date)
      local d="${2:?Falta la fecha YYYY-MM-DD}"
      local f="$VAULT_ROOT/residentes/pase-de-sala/${d}_pase.md"
      [[ -f "$f" ]] && cat "$f" || echo "No existe pase para $d"
      ;;
    *)
      echo "Subcomando desconocido: $sub. Usar: pase hoy | pase ver | pase date YYYY-MM-DD" >&2; exit 1 ;;
  esac
}

# ─── RESIDENTES ───────────────────────────────────────────────────
cmd_residentes() {
  local resdir="$VAULT_ROOT/residentes/residentes"
  echo -e "${BOLD}=== Fichas de residentes ===${RESET}"
  if [[ -z "$(ls -A "$resdir" 2>/dev/null)" ]]; then
    echo -e "${YELLOW}Sin fichas aún. Crear en: $resdir/${RESET}"
  else
    find "$resdir" -name "*.md" | sort | sed "s|$VAULT_ROOT/||"
  fi
}

# ─── CONSULTORIOS ─────────────────────────────────────────────────
cmd_consultorio() {
  local location="${1:?Falta localización: ospedyc | pilar}"
  local date="${2:-$TODAY}"
  local dir="$VAULT_ROOT/agenda/consultorios/${location}"
  if [[ ! -d "$dir" ]]; then
    echo -e "${RED}Localización desconocida: $location${RESET}" >&2; exit 1
  fi
  # Buscar lista del día o la más reciente
  local f="${dir}/${date}_lista.md"
  if [[ -f "$f" ]]; then
    echo -e "${BOLD}=== Consulta $location — $date ===${RESET}"
    cat "$f"
  else
    echo -e "${YELLOW}No hay lista para $date en $location.${RESET}"
    local last
    last=$(find "$dir" -name "*_lista.md" | sort | tail -1)
    [[ -n "$last" ]] && echo "Última disponible: $last" && cat "$last"
  fi
}

# ─── BÚSQUEDA ────────────────────────────────────────────────────
cmd_search() {
  local sub="${1:-}"
  case "$sub" in
    type)
      local t="${2:?Falta el tipo}"
      grep -rl "^type: $t" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | sed "s|$VAULT_ROOT/||" | sort
      ;;
    tag)
      local tag="${2:?Falta el tag}"
      grep -rl "tags:.*$tag\|^  - $tag$" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | sed "s|$VAULT_ROOT/||" | sort
      ;;
    *)
      local kw="${1:?Falta keyword de búsqueda}"
      echo -e "${BOLD}=== Resultados para: \"$kw\" ===${RESET}"
      grep -rn "$kw" "$VAULT_ROOT" --include="*.md" \
        | grep -v "_templates" \
        | sed "s|$VAULT_ROOT/||" \
        | head -50
      ;;
  esac
}

# ─── ESTADÍSTICAS ────────────────────────────────────────────────
cmd_stats() {
  echo -e "${BOLD}=== MedVault — Estadísticas ===${RESET}"
  local pac act evo daily tasks meet
  pac=$(find "$VAULT_ROOT/pacientes" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  act=$({ grep -rl "^status: activo" "$VAULT_ROOT/pacientes" --include="*.md" 2>/dev/null || true; } | wc -l)
  evo=$(find "$VAULT_ROOT/pacientes" -name "*_evolucion.md" 2>/dev/null | wc -l)
  daily=$(find "$VAULT_ROOT/agenda/daily" -name "*.md" 2>/dev/null | wc -l)
  tasks=$({ grep -rn -e "- \[ \]" "$VAULT_ROOT" --include="*.md" 2>/dev/null || true; } | { grep -v "_templates" || true; } | wc -l)
  meet=$(find "$VAULT_ROOT/reuniones" -name "*.md" 2>/dev/null | wc -l)

  echo -e "  ${CYAN}Pacientes totales:${RESET}      $pac"
  echo -e "  ${CYAN}Pacientes activos:${RESET}      $act"
  echo -e "  ${CYAN}Evoluciones totales:${RESET}    $evo"
  echo -e "  ${CYAN}Notas diarias:${RESET}          $daily"
  echo -e "  ${CYAN}Tareas pendientes:${RESET}      $tasks"
  echo -e "  ${CYAN}Reuniones/ateneos:${RESET}      $meet"
}

# ─── INIT ────────────────────────────────────────────────────────
cmd_init() {
  local sub="${1:-day}"
  case "$sub" in
    day)
      local f="$VAULT_ROOT/agenda/daily/$TODAY.md"
      if [[ -f "$f" ]]; then
        echo "Nota del día ya existe: $f"
      else
        sed \
          -e "s/{{DATE}}/$TODAY/g" \
          -e "s/{{DOW}}/$DOW/g" \
          "$VAULT_ROOT/_templates/TPL_daily-note.md" > "$f"
        echo -e "${GREEN}Nota diaria creada:${RESET} $f"
      fi
      ;;
    week)
      local f="$VAULT_ROOT/agenda/weekly/$WEEK.md"
      if [[ -f "$f" ]]; then
        echo "Resumen semanal ya existe: $f"
      else
        local ws we
        ws=$(date -d "last monday" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
        we=$(date -d "next sunday" +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)
        cat > "$f" <<WEEKEOF
---
type: weekly-overview
week: $WEEK
date_start: $ws
date_end: $we
locations_this_week: []
highlights: []
tags: [agenda, semanal]
---

# Resumen semanal — $WEEK

## Días de la semana

- [[agenda/daily/${ws}|Lunes $ws]]
- Martes
- Miércoles
- Jueves
- Viernes
- Sábado
- Domingo

## Highlights de la semana

## Tareas completadas esta semana

## Pendientes para la próxima semana

WEEKEOF
        echo -e "${GREEN}Resumen semanal creado:${RESET} $f"
      fi
      ;;
    *)
      echo "Subcomando desconocido: $sub. Usar: init day | init week" >&2; exit 1 ;;
  esac
}

# ─── LINT ────────────────────────────────────────────────────────
cmd_lint() {
  echo -e "${BOLD}=== Verificando links internos ===${RESET}"
  local broken=0
  while IFS= read -r line; do
    local target
    target=$(echo "$line" | grep -oP '\[\[\K[^\]|]+' | head -1 || true)
    local srcfile
    srcfile=$(echo "$line" | cut -d: -f1)
    if [[ -n "$target" ]]; then
      local resolved="$VAULT_ROOT/${target}.md"
      if [[ ! -f "$resolved" ]] && [[ ! -f "$VAULT_ROOT/$target" ]]; then
        echo -e "  ${YELLOW}ROTO${RESET}: $srcfile → [[${target}]]"
        ((broken++)) || true
      fi
    fi
  done < <(grep -rn "\[\[" "$VAULT_ROOT" --include="*.md" | grep -v "_templates" | grep -v "^Binary")
  if [[ $broken -eq 0 ]]; then
    echo -e "${GREEN}Todo OK — Sin links rotos.${RESET}"
  else
    echo -e "${RED}Links rotos encontrados: $broken${RESET}"
  fi
}

# ─── PATIENT UTILS ───────────────────────────────────────────────
cmd_patient() {
  local sub="${1:-search}"
  case "$sub" in
    search)
      local kw="${2:?Falta keyword}"
      echo -e "${BOLD}=== Pacientes que coinciden con: \"$kw\" ===${RESET}"
      grep -rl "$kw" "$VAULT_ROOT/pacientes" --include="*.md" \
        | grep -v "_index" \
        | sed "s|$VAULT_ROOT/||" | sort
      ;;
    evolutions)
      local id="${2:?Falta patient_id}"
      local evdir="$VAULT_ROOT/pacientes/${id}/evoluciones"
      if [[ -d "$evdir" ]]; then
        find "$evdir" -name "*.md" | sort | sed "s|$VAULT_ROOT/||"
      else
        echo -e "${YELLOW}No se encontró el paciente: $id${RESET}"
      fi
      ;;
    *)
      echo "Subcomando desconocido: $sub. Usar: patient search | patient evolutions" >&2; exit 1 ;;
  esac
}

# ─── DISPATCH ────────────────────────────────────────────────────
main() {
  local cmd="${1:-help}"
  shift || true
  case "$cmd" in
    agenda)         cmd_agenda "$@" ;;
    new)
      local sub="${1:-}"; shift || true
      if [[ "$sub" == "patient" ]]; then
        cmd_new_patient "$@"
      else
        echo -e "${RED}Subcomando desconocido: $sub${RESET}" >&2; usage; exit 1
      fi
      ;;
    tasks)          cmd_tasks "$@" ;;
    search)         cmd_search "$@" ;;
    stats)          cmd_stats ;;
    init)           cmd_init "$@" ;;
    lint)           cmd_lint ;;
    patient)        cmd_patient "$@" ;;
    pase)           cmd_pase "$@" ;;
    residentes)     cmd_residentes ;;
    consultorio)    cmd_consultorio "$@" ;;
    help|--help|-h) usage ;;
    *)
      echo -e "${RED}Comando desconocido: $cmd${RESET}" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
