#!/usr/bin/env bash
# Globalus iMuzika skill'ų diegimas (~/.claude/skills) — kad būtų prieinami
# VISUOSE projektuose šioje mašinoje, ne tik šiame repo.
# Paleisti vieną kartą kiekvienoje mašinoje:  bash scripts/install-skills-global.sh
# Tas pats rinkinys kaip repo .claude/skills/ (žr. docs/claude-skills.md, skills-lock.json).
set -euo pipefail

add() { npx -y skills add "$1" "${@:2}" -a claude-code -g --copy -y; }

add vercel-labs/skills        -s find-skills
add vercel-labs/agent-browser -s agent-browser
add vercel-labs/agent-skills  -s web-design-guidelines -s writing-guidelines
add anthropics/skills         -s webapp-testing
add obra/superpowers          -s systematic-debugging -s verification-before-completion -s brainstorming \
                              -s dispatching-parallel-agents
add obra/episodic-memory      -s remembering-conversations
add mattpocock/skills         -s tdd -s triage -s grill-me -s grill-with-docs -s grilling -s domain-modeling \
                              -s research -s to-spec -s to-tickets \
                              -s improve-codebase-architecture -s codebase-design -s git-guardrails-claude-code \
                              -s wait-what -s setup-pre-commit -s writing-for-agents -s prototype -s implement \
                              -s resolving-merge-conflicts

echo "OK: 28 skill'ų įdiegta globaliai. Patikra: npx skills ls -g"
