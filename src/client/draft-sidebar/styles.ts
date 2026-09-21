export const DRAFT_SIDEBAR_CSS = `
.dsd-panel{flex:none;max-height:min(42%,360px);overflow:auto;padding:0 8px 8px;border-bottom:1px solid var(--dsw-alias-border-l3)}
.dsd-panel[data-surface=tab]{flex:1;min-height:0;max-height:none;border-bottom:0}
.dsd-panel[data-surface=popover]{flex:1;min-height:0;max-height:none;border-bottom:0;padding:4px 8px 8px}
.dsd-heading{display:flex;align-items:center;gap:8px;padding:8px 8px 4px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-transform:uppercase;letter-spacing:.04em}
.dsd-heading-label{flex:1;min-width:0}
.dsd-add{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:0;border-radius:4px;padding:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:18px/1 sans-serif;cursor:pointer}
.dsd-add:hover,.dsd-add:focus-visible{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dsd-row{position:relative;display:flex;align-items:center;gap:6px;height:32px;padding:0 8px;border-radius:8px;box-sizing:border-box;outline:none;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}
.dsd-row:hover,.dsd-row:focus-visible,.dsd-row[data-selected=true],.dsd-row[data-menu=true]{background:var(--dsw-alias-interactive-bg-hover)}
.dsd-row:focus-visible{box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}
.dsd-dot{flex:none;width:8px;height:8px;border:1px dashed currentColor;border-radius:50%;opacity:.72}
.dsd-row[data-state=error] .dsd-dot{border-style:solid;color:var(--dsw-alias-state-error-primary,#d84c4c)}
.dsd-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}
.dsd-workspace,.dsd-badge{flex:none;max-width:34%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px}
.dsd-badge{max-width:none}
.dsd-actions{position:relative;flex:none}
.dsd-menu-button{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:0;border-radius:4px;padding:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsd-menu-button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.dsd-menu{position:fixed;z-index:2147483001;min-width:132px;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-button-elevated-fill));box-shadow:var(--dsw-shadow-l2,0 8px 24px rgba(0,0,0,.18))}
.dsd-menu-item{display:block;width:100%;border:0;border-radius:5px;padding:6px 8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}
.dsd-menu-item:hover,.dsd-menu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dsd-menu-item[data-danger=true]{color:var(--dsw-alias-state-error-primary,#d84c4c)}
.dsd-confirm{padding:6px 8px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:17px}
.dsd-confirm-actions{display:flex;gap:4px;padding:2px 4px 4px}
.dsd-rename{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:2px 5px;background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);font:inherit;outline:none}
.dsd-error{padding:4px 8px;color:var(--dsw-alias-state-error-primary,#d84c4c);font-size:12px;line-height:17px}
.dsd-row[data-drop=before]::before,.dsd-row[data-drop=after]::after{content:"";position:absolute;left:4px;right:4px;height:2px;background:var(--dsw-alias-state-business-primary);pointer-events:none}
.dsd-row[data-drop=before]::before{top:-1px}.dsd-row[data-drop=after]::after{bottom:-1px}
@media(prefers-reduced-motion:reduce){.dsd-row{scroll-behavior:auto}}
`;
