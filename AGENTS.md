# PropVibe AI Agent Workspace Directives

<!-- Mirrored from GEMINI.md for cross-tool compatibility -->
See [[SOUL.md]] for project background, judging alignment, and hackathon directives.

## 🎯 Primary Directives
1. **Never commit secrets**: Check that `.env` files are never tracked in git; always provide `.env.example`.
2. **Prioritize Working Live Demo**: Avoid over-engineering complex infrastructure that can fail during a 5-minute presentation. Keep client-side fallbacks available so the UI functions seamlessly even if the backend is restarting.
3. **UI/UX Excellence**: Use Vanilla CSS tokens, glassmorphism, responsive flex/grid layouts, micro-animations, and rich color schemes. Avoid generic bootstrap/unstyled appearance.
4. **Accessible & Typed**: Maintain TypeScript interfaces for all data structures (UserProfile, Match, RentCalculation, LeaseClause) and write clear Pydantic schemas in FastAPI.
5. **Regular Git History**: Remind the team to commit functional chunks every 1-2 hours across members with meaningful commit messages.
