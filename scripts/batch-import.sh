#!/bin/bash
# Batch import v0 templates via the API
# Templates and Components are separate categories

API="http://localhost:8096/api/import"

import_template() {
  local url="$1"
  local category="$2"
  local name="$3"
  echo "[IMPORT] $category/$name from $url"
  result=$(curl -s -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$url\",\"category\":\"$category\",\"name\":\"$name\",\"save\":true}" 2>&1)
  len=$(echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('sourceCode','')))" 2>/dev/null || echo "0")
  echo "  -> $len chars"
}

# ==================== TEMPLATES ====================

# Landing Pages
import_template "https://v0.app/templates/Auw4otwlr20" "landing" "compute-ai-platform" &
import_template "https://v0.app/templates/XQxxv76lK5w" "landing" "pointer-ai" &
import_template "https://v0.app/templates/annqMtFCROP" "landing" "evasion-ecommerce" &
wait

import_template "https://v0.app/templates/zdiN8dHwaaT" "landing" "brillance-saas" &
import_template "https://v0.app/templates/8QhCJAwn16K" "landing" "mindspace-saas" &
wait

# Dashboards
import_template "https://v0.app/templates/d7j5B58dlp4" "dashboards" "cms-admin" &
import_template "https://v0.app/templates/Pf7lw1nypu5" "dashboards" "shadcn-dashboard" &
import_template "https://v0.app/templates/jrYuNlqLsd9" "dashboards" "financial-analytics" &
wait

import_template "https://v0.app/templates/IVWc0rHCBAL" "dashboards" "dashboard-design" &
import_template "https://v0.app/templates/shuOX59VNOv" "dashboards" "finbro" &
wait

# Apps & Games
import_template "https://v0.app/templates/RTz7dLt3u0c" "apps" "appsport" &
import_template "https://v0.app/templates/qgqM6vLnylJ" "apps" "transport-app" &
import_template "https://v0.app/templates/rDbHKxX6tKy" "apps" "zerogrid" &
wait

# Auth / Login
import_template "https://v0.app/templates/VEoDcF84vxz" "auth" "liquid-glass-login" &
import_template "https://v0.app/templates/gEmHlupUYoH" "auth" "neumorphic-onboarding" &
import_template "https://v0.app/templates/lgh5A223SiR" "auth" "login-02" &
wait

# Portfolio & Blog
import_template "https://v0.app/templates/peTiHBkr23W" "portfolio" "interactive-gallery" &
import_template "https://v0.app/templates/NjOUgG6VT7X" "portfolio" "eincode-digital-lab" &
import_template "https://v0.app/templates/I96b70NNT2E" "portfolio" "ascii-art-portfolio" &
wait

import_template "https://v0.app/templates/wvXzAf0NBYB" "portfolio" "resume-template" &
wait

# E-commerce
import_template "https://v0.app/templates/ppoa1Yu4KX9" "ecommerce" "modern-tote-store" &
import_template "https://v0.app/templates/Umx1e3VQmpL" "ecommerce" "luxury-store" &
import_template "https://v0.app/templates/V3jVewszBPu" "ecommerce" "pet-store" &
wait

# AI
import_template "https://v0.app/templates/GzHBHQAiS2F" "ai" "chatbot-interface" &
import_template "https://v0.app/templates/7YygHkO1oj4" "ai" "creative-studio" &
import_template "https://v0.app/templates/FRTdsTVElQ9" "ai" "infographics-generator" &
wait

# Animations
import_template "https://v0.app/templates/mE2nwltmoDT" "animations" "infinite-scroll-images" &
import_template "https://v0.app/templates/Dav88XZy66u" "animations" "apple-scroll-3d" &
import_template "https://v0.app/templates/cAawT1AJaki" "animations" "shader-gradient" &
wait

# Website Templates
import_template "https://v0.app/templates/wNB9dqGZXGU" "websites" "cliste-navigation" &
import_template "https://v0.app/templates/VZ9EEGUUq9M" "websites" "unusual-hero" &
import_template "https://v0.app/templates/jz21jJIFr0i" "websites" "motocross-landing" &
wait

# Agents
import_template "https://v0.app/templates/Uwmr1erx4dK" "agents" "ai-workflow-canvas" &
import_template "https://v0.app/templates/jCeGSebTxo0" "agents" "task-orchestrator" &
import_template "https://v0.app/templates/7JdqEwKmtIG" "agents" "ai-ad-creator" &
wait

# ==================== COMPONENTS (separate section) ====================

# shadcn-inspired components from v0
import_template "https://v0.app/templates/XqrIezRilBR" "components" "glow-menu" &
import_template "https://v0.app/templates/fLjYRXrijvp" "components" "toast" &
import_template "https://v0.app/templates/rjaI1QX2ApZ" "components" "shadcn-components" &
wait

# shadcn component examples
import_template "https://ui.shadcn.com/docs/components/base/card" "components" "shadcn-card" &
import_template "https://ui.shadcn.com/docs/components/base/data-table" "components" "shadcn-data-table" &
import_template "https://ui.shadcn.com/docs/components/base/dialog" "components" "shadcn-dialog" &
wait

import_template "https://ui.shadcn.com/docs/components/base/sidebar" "components" "shadcn-sidebar" &
import_template "https://ui.shadcn.com/docs/components/base/chart" "components" "shadcn-chart" &
wait

echo ""
echo "=== IMPORT COMPLETE ==="
find "${TEMPLATES_DIR:-./templates}" -name "*.tsx" | wc -l
echo "templates imported"
