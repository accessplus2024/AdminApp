/* @ds-bundle: {"format":3,"namespace":"AccessPlusDesignSystem_ece1f0","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/Card.jsx"},{"name":"CardDescription","sourcePath":"components/core/Card.jsx"},{"name":"CardBody","sourcePath":"components/core/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card.jsx"},{"name":"Stat","sourcePath":"components/data/Stat.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"eb88fc49a1d7","components/core/Badge.jsx":"c955c15d0012","components/core/Button.jsx":"7e8bc53fbd3c","components/core/Card.jsx":"65595d9a35b3","components/data/Stat.jsx":"af7f67a66927","components/data/Table.jsx":"284cd729f54b","components/feedback/Alert.jsx":"2dba631c81af","components/feedback/Dialog.jsx":"92e7f77dc987","components/forms/Checkbox.jsx":"b2516cf4d156","components/forms/Field.jsx":"097696984864","components/forms/Input.jsx":"01c1a91a62fd","components/forms/Select.jsx":"1c0ee6b919d0","components/forms/Switch.jsx":"a62d699c8a2a","components/forms/Textarea.jsx":"2c30bde85f48","components/navigation/Tabs.jsx":"ab4667dcb065","ui_kits/admin/AppShell.jsx":"753c094a779a","ui_kits/admin/Dashboard.jsx":"8ac2d5a8a4ff","ui_kits/admin/Login.jsx":"a31f53d9618a","ui_kits/admin/Newsletter.jsx":"fb216e4dbf8a","ui_kits/admin/Opportunities.jsx":"18a425ffdb12","ui_kits/admin/OpportunityDetail.jsx":"f19eef6333bb","ui_kits/admin/OpportunityEditor.jsx":"da95d893af76","ui_kits/admin/Team.jsx":"f8eda089078b","ui_kits/admin/data.js":"ef6d82ee3fc1","ui_kits/admin/icons.js":"2ed65e92242c"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AccessPlusDesignSystem_ece1f0 = window.AccessPlusDesignSystem_ece1f0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Round avatar. Falls back to initials (on a brand-coloured circle) when no src. */
function Avatar({
  src,
  alt = '',
  initials,
  size = 'md',
  color,
  className = '',
  ...props
}) {
  const classes = ['ap-avatar', `ap-avatar--${size}`, className].filter(Boolean).join(' ');
  const style = color ? {
    background: color
  } : undefined;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: classes,
    style: style
  }, props), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt
  }) : (initials || '').slice(0, 2).toUpperCase());
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Small status / category label. */
function Badge({
  variant = 'neutral',
  dot = false,
  className = '',
  children,
  ...props
}) {
  const classes = ['ap-badge', `ap-badge--${variant}`, dot ? 'ap-badge--dot' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: classes
  }, props), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Access+Plus Button — shadcn-flavoured, brand-styled.
 * Renders an <a> when `href` is provided, otherwise a <button>.
 */
function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  iconLeft = null,
  iconRight = null,
  className = '',
  href,
  type = 'button',
  children,
  ...props
}) {
  const classes = ['ap-btn', `ap-btn--${variant}`, size === 'icon' ? 'ap-btn--icon' : `ap-btn--${size}`, pill ? 'ap-btn--pill' : '', className].filter(Boolean).join(' ');
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, iconLeft, children, iconRight);
  if (href) {
    return /*#__PURE__*/React.createElement("a", _extends({
      href: href,
      className: classes
    }, props), content);
  }
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: classes
  }, props), content);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Surface container. Compose with the sub-components below. */
function Card({
  interactive = false,
  flat = false,
  className = '',
  children,
  ...props
}) {
  const classes = ['ap-card', flat ? 'ap-card--flat' : '', interactive ? 'ap-card--interactive' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: classes
  }, props), children);
}
function CardHeader({
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ap-card-header ${className}`
  }, props), children);
}
function CardTitle({
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ap-card-title ${className}`
  }, props), children);
}
function CardDescription({
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ap-card-desc ${className}`
  }, props), children);
}
function CardBody({
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ap-card-body ${className}`
  }, props), children);
}
function CardFooter({
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ap-card-footer ${className}`
  }, props), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/Stat.jsx
try { (() => {
/** KPI / metric block. Pair inside a Card for dashboard tiles. */
function Stat({
  label,
  value,
  icon = null,
  delta,
  deltaDir = 'up',
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ['ap-stat', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("div", {
    className: "ap-stat-label"
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "ap-stat-icon"
  }, icon), label), /*#__PURE__*/React.createElement("div", {
    className: "ap-stat-value"
  }, value), delta != null && /*#__PURE__*/React.createElement("span", {
    className: `ap-stat-delta ap-stat-delta--${deltaDir}`
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    width: "13",
    height: "13",
    "aria-hidden": "true"
  }, deltaDir === 'up' ? /*#__PURE__*/React.createElement("path", {
    d: "m6 15 6-6 6 6"
  }) : /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  })), delta));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Stat.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
/**
 * Data table. `columns`: [{ key, header, align?, width? }].
 * `data`: array of row objects. Optional `renderCell(row, col)` for custom cells.
 */
function Table({
  columns = [],
  data = [],
  renderCell,
  rowKey = 'id',
  className = ''
}) {
  return /*#__PURE__*/React.createElement("table", {
    className: ['ap-table', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.align || 'left',
      width: c.width
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, data.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: row[rowKey] != null ? row[rowKey] : i
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      textAlign: c.align || 'left'
    }
  }, renderCell ? renderCell(row, c) : row[c.key]))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Inline message banner. Pass `icon` (Lucide node) and optional `title`. */
function Alert({
  variant = 'info',
  icon = null,
  title,
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['ap-alert', `ap-alert--${variant}`, className].filter(Boolean).join(' '),
    role: "status"
  }, props), icon, /*#__PURE__*/React.createElement("div", null, title != null && /*#__PURE__*/React.createElement("div", {
    className: "ap-alert-title"
  }, title), children != null && /*#__PURE__*/React.createElement("div", {
    className: "ap-alert-desc"
  }, children)));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/** Centered modal dialog with scrim. Controlled via `open` / `onClose`. */
function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  width = 460,
  children
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      background: 'rgba(14,0,51,.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: width,
      background: 'var(--card)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-xl)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-6) var(--space-6) 0'
    }
  }, title != null && /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--text-xl)',
      letterSpacing: 'var(--tracking-tight)'
    }
  }, title), description != null && /*#__PURE__*/React.createElement("p", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)',
      marginTop: 6
    }
  }, description)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--space-5) var(--space-6)'
    }
  }, children), footer != null && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--space-6) var(--space-6)',
      display: 'flex',
      gap: 'var(--space-3)',
      justifyContent: 'flex-end'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Checkbox with brand azul fill + check glyph. */
function Checkbox({
  label,
  className = '',
  ...props
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ['ap-check', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox"
  }, props)), /*#__PURE__*/React.createElement("span", {
    className: "ap-check-box"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  }))), label != null && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
/** Label + control + hint wrapper for form fields. */
function Field({
  label,
  htmlFor,
  hint,
  error,
  className = '',
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, label != null && /*#__PURE__*/React.createElement("label", {
    className: "ap-field-label",
    htmlFor: htmlFor
  }, label), children, (hint != null || error != null) && /*#__PURE__*/React.createElement("span", {
    className: ['ap-field-hint', error != null ? 'ap-field-hint--error' : ''].filter(Boolean).join(' ')
  }, error != null ? error : hint));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Text input. Pass `icon` (a Lucide node) for a leading icon. */
function Input({
  icon = null,
  error = false,
  className = '',
  ...props
}) {
  const input = /*#__PURE__*/React.createElement("input", _extends({
    className: ['ap-input', error ? 'ap-input--error' : '', className].filter(Boolean).join(' ')
  }, props));
  if (icon) {
    return /*#__PURE__*/React.createElement("div", {
      className: "ap-input-group"
    }, icon, input);
  }
  return input;
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Native select styled to match, with a chevron affordance. */
function Select({
  className = '',
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ap-select-wrap"
  }, /*#__PURE__*/React.createElement("select", _extends({
    className: ['ap-select', className].filter(Boolean).join(' ')
  }, props), children), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Toggle switch (azul when on). */
function Switch({
  label,
  className = '',
  ...props
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ['ap-switch', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch"
  }, props)), /*#__PURE__*/React.createElement("span", {
    className: "ap-switch-track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ap-switch-thumb"
  })), label != null && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  error = false,
  className = '',
  ...props
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    className: ['ap-textarea', error ? 'ap-textarea--error' : '', className].filter(Boolean).join(' ')
  }, props));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Tabs / segmented control.
 * `items`: [{ value, label }]; controlled via `value` + `onChange`.
 */
function Tabs({
  items = [],
  value,
  onChange,
  variant = 'solid',
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    className: ['ap-tabs', variant === 'line' ? 'ap-tabs--line' : '', className].filter(Boolean).join(' ')
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.value,
    role: "tab",
    type: "button",
    className: "ap-tab",
    "data-active": value === it.value,
    "aria-selected": value === it.value,
    onClick: () => onChange && onChange(it.value)
  }, it.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/AppShell.jsx
try { (() => {
// AppShell — dark sidebar + topbar chrome for the Access+ admin app.
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Avatar,
    Badge,
    Button,
    Input
  } = NS;
  const Ic = (n, cls) => window.Ic(n, cls);
  function AppShell({
    nav,
    active,
    onNav,
    title,
    subtitle,
    actions,
    onLogout,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("aside", {
      style: {
        width: 'var(--sidebar-width)',
        flex: 'none',
        background: 'var(--sidebar)',
        color: 'var(--sidebar-foreground)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '20px 18px 18px'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/icon-branco.png",
      alt: "",
      style: {
        width: 34,
        height: 34,
        borderRadius: '50%'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 19,
        color: '#fff',
        letterSpacing: '-0.01em'
      }
    }, "Access", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--grifa-texto)'
      }
    }, "+"), "Plus")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 12px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'var(--sidebar-muted)',
        margin: '8px 6px 4px'
      }
    }, "Gest\xE3o"), /*#__PURE__*/React.createElement("nav", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '0 12px'
      }
    }, nav.map(item => {
      const on = active === item.id;
      return /*#__PURE__*/React.createElement("button", {
        key: item.id,
        onClick: () => onNav(item.id),
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          width: '100%',
          padding: '9px 12px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: on ? 600 : 500,
          background: on ? 'var(--sidebar-active)' : 'transparent',
          color: on ? '#fff' : 'var(--sidebar-foreground)',
          transition: 'background-color .14s ease'
        },
        onMouseEnter: e => {
          if (!on) e.currentTarget.style.background = 'var(--sidebar-accent)';
        },
        onMouseLeave: e => {
          if (!on) e.currentTarget.style.background = 'transparent';
        }
      }, Ic(item.icon, 'nav-ico'), /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1
        }
      }, item.label), item.badge && /*#__PURE__*/React.createElement(Badge, {
        variant: "primary"
      }, item.badge));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 'auto',
        padding: 12,
        borderTop: '1px solid var(--sidebar-border)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => onNav('config'),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '9px 12px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 500,
        background: active === 'config' ? 'var(--sidebar-accent)' : 'transparent',
        color: 'var(--sidebar-foreground)'
      }
    }, Ic('settings', 'nav-ico'), /*#__PURE__*/React.createElement("span", null, "Configura\xE7\xF5es")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 10px 4px'
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: "CR",
      size: "sm",
      color: "var(--grifa-topicos)"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        lineHeight: 1.2,
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, "Camila Rocha"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--sidebar-muted)'
      }
    }, "Curadoria \xB7 Admin")), /*#__PURE__*/React.createElement("button", {
      onClick: onLogout,
      "aria-label": "Sair",
      title: "Sair",
      style: {
        border: 'none',
        background: 'transparent',
        color: 'var(--sidebar-muted)',
        cursor: 'pointer',
        padding: 6,
        borderRadius: 8,
        display: 'inline-flex'
      },
      onMouseEnter: e => {
        e.currentTarget.style.color = '#fff';
        e.currentTarget.style.background = 'var(--sidebar-accent)';
      },
      onMouseLeave: e => {
        e.currentTarget.style.color = 'var(--sidebar-muted)';
        e.currentTarget.style.background = 'transparent';
      }
    }, Ic('log-out', 'nav-ico-sm'))))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement("header", {
      style: {
        height: 'var(--topbar-height)',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 28px',
        background: 'rgba(255,255,255,.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '-0.02em',
        lineHeight: 1.1
      }
    }, title)), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 240,
        display: 'flex'
      },
      className: "topbar-search"
    }, /*#__PURE__*/React.createElement(Input, {
      placeholder: "Buscar\u2026",
      icon: Ic('search', 'ico-sm')
    })), /*#__PURE__*/React.createElement("button", {
      className: "topbar-icon-btn",
      "aria-label": "Notifica\xE7\xF5es"
    }, Ic('bell', 'ico'), /*#__PURE__*/React.createElement("span", {
      className: "topbar-dot"
    })), actions), /*#__PURE__*/React.createElement("main", {
      style: {
        flex: 1,
        padding: '26px 28px 40px',
        maxWidth: 1180,
        width: '100%'
      }
    }, subtitle && /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 14,
        marginTop: -8,
        marginBottom: 20
      }
    }, subtitle), children)));
  }
  window.AppShell = AppShell;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Dashboard.jsx
try { (() => {
// Dashboard (Visão geral) — opportunities focused
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    CardFooter,
    Stat,
    Table,
    Badge,
    Button
  } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  function Dashboard({
    onOpen,
    onNew
  }) {
    const recent = D.opportunities.slice(0, 5);
    const cols = [{
      key: 'titulo',
      header: 'Oportunidade'
    }, {
      key: 'tipo',
      header: 'Tipo'
    }, {
      key: 'inscritos',
      header: 'Inscritos',
      align: 'right'
    }, {
      key: 'status',
      header: 'Status'
    }];
    // distribution by tipo
    const byTipo = {};
    D.opportunities.forEach(o => {
      byTipo[o.tipo] = (byTipo[o.tipo] || 0) + 1;
    });
    const dist = Object.keys(byTipo).map(k => ({
      k,
      v: byTipo[k]
    })).sort((a, b) => b.v - a.v).slice(0, 5);
    const maxV = Math.max.apply(null, dist.map(d => d.v));
    const distColors = ['var(--azul)', 'var(--grifa-topicos)', 'var(--citacoes)', 'var(--grifa-texto)', 'var(--vermelha)'];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 22
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16
      }
    }, D.stats.map((s, i) => /*#__PURE__*/React.createElement(Card, {
      key: i
    }, /*#__PURE__*/React.createElement(CardBody, null, /*#__PURE__*/React.createElement(Stat, {
      label: s.label,
      value: s.value,
      icon: Ic(s.icon, 'ico-sm'),
      delta: s.delta,
      deltaDir: s.dir
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.7fr 1fr',
        gap: 22,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement(Card, {
      flat: true
    }, /*#__PURE__*/React.createElement(CardHeader, {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingBottom: 12
      }
    }, /*#__PURE__*/React.createElement(CardTitle, null, "Oportunidades recentes"), /*#__PURE__*/React.createElement(Button, {
      variant: "link",
      iconRight: Ic('arrow-right', 'ico-sm'),
      onClick: onNew
    }, "Nova")), /*#__PURE__*/React.createElement(Table, {
      columns: cols,
      data: recent,
      renderCell: (r, c) => {
        if (c.key === 'titulo') return /*#__PURE__*/React.createElement("button", {
          onClick: () => onOpen && onOpen(r),
          className: "link-cell"
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            fontWeight: 600
          }
        }, r.titulo), /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 12,
            color: 'var(--muted-foreground)'
          }
        }, r.org));
        if (c.key === 'tipo') return /*#__PURE__*/React.createElement(Badge, {
          variant: D.tipoVariant[r.tipo] || 'neutral'
        }, r.tipo);
        if (c.key === 'status') return /*#__PURE__*/React.createElement(Badge, {
          variant: D.statusVariant[r.status],
          dot: true
        }, r.status);
        if (c.key === 'inscritos') return /*#__PURE__*/React.createElement("span", {
          style: {
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600
          }
        }, r.inscritos || '—');
        return r[c.key];
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 22
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Por tipo")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingTop: 10
      }
    }, dist.map((d, i) => /*#__PURE__*/React.createElement("div", {
      key: d.k
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12.5,
        marginBottom: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ink)'
      }
    }, d.k), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        fontWeight: 600
      }
    }, d.v)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 7,
        borderRadius: 99,
        background: 'var(--neutral-100)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        borderRadius: 99,
        width: d.v / maxV * 100 + '%',
        background: distColors[i % distColors.length]
      }
    })))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Atividade")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        paddingTop: 8
      }
    }, D.activity.map((a, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28,
        height: 28,
        flex: 'none',
        borderRadius: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, ' + a.color + ' 14%, white)',
        color: a.color
      }
    }, Ic(a.icon, 'ico-sm')), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        lineHeight: 1.35
      },
      dangerouslySetInnerHTML: {
        __html: a.text
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--muted-foreground)',
        marginTop: 1
      }
    }, a.time)))))))));
  }
  window.Dashboard = Dashboard;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Login.jsx
try { (() => {
// Login — branded entry screen for the admin panel
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Button,
    Input,
    Field,
    Checkbox
  } = NS;
  const Ic = (n, cls) => window.Ic(n, cls);
  function Login({
    onLogin
  }) {
    const [email, setEmail] = React.useState('camila@accessplus.com.br');
    const submit = e => {
      e.preventDefault();
      onLogin && onLogin();
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
        minHeight: '100vh',
        background: 'var(--card)'
      },
      className: "ap-login"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ap-login-art",
      style: {
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--ink)'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/login-keyvisual.png",
      alt: "Access+Plus",
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: '32% center'
      }
    }), /*#__PURE__*/React.createElement("div", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '38%',
        background: 'linear-gradient(to top, rgba(14,0,51,0.72) 0%, rgba(14,0,51,0) 100%)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 44,
        bottom: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: '#fff'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/icon-badge.png",
      alt: "",
      style: {
        width: 34,
        height: 34
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 18,
        letterSpacing: '-0.01em'
      }
    }, "Access", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--citacoes)'
      }
    }, "+"), "Plus"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px'
      }
    }, /*#__PURE__*/React.createElement("form", {
      onSubmit: submit,
      style: {
        width: '100%',
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/icon-badge.png",
      alt: "",
      style: {
        width: 40,
        height: 40
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '-0.01em'
      }
    }, "Access", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--azul)'
      }
    }, "+"), "Plus")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 26,
        letterSpacing: '-0.02em'
      }
    }, "Entrar no painel"), /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--muted-foreground)',
        fontSize: 14,
        marginTop: 6
      }
    }, "Acesso restrito \xE0 equipe Access+.")), /*#__PURE__*/React.createElement(Field, {
      label: "E-mail",
      htmlFor: "lg-e"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "lg-e",
      type: "email",
      value: email,
      onChange: e => setEmail(e.target.value),
      icon: Ic('mail', 'ico-sm'),
      placeholder: "voce@accessplus.com.br"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Senha",
      htmlFor: "lg-p"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "lg-p",
      type: "password",
      defaultValue: "senha-secreta",
      icon: Ic('lock', 'ico-sm')
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }
    }, /*#__PURE__*/React.createElement(Checkbox, {
      label: "Manter conectado",
      defaultChecked: true
    }), /*#__PURE__*/React.createElement("a", {
      href: "#",
      style: {
        fontSize: 13,
        fontWeight: 500
      },
      onClick: e => e.preventDefault()
    }, "Esqueci a senha")), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      type: "submit",
      iconRight: Ic('arrow-right', 'ico-sm'),
      style: {
        width: '100%'
      }
    }, "Entrar"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)',
        textAlign: 'center',
        marginTop: 4
      }
    }, "Problemas para acessar? Fale com a administra\xE7\xE3o do time."))));
  }
  window.Login = Login;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Newsletter.jsx
try { (() => {
// Newsletter — generate & publish from Instagram accounts
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Badge,
    Button,
    Tabs,
    Table,
    Input,
    Checkbox
  } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  function Account({
    a,
    on,
    onToggle
  }) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onToggle,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '7px 12px 7px 8px',
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
        background: on ? 'var(--azul-soft)' : 'var(--card)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: a.cor,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-display)'
      }
    }, a.nome.charAt(0)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: on ? 'var(--azul)' : 'var(--ink)'
      }
    }, a.handle), on && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--azul)'
      }
    }, Ic('check', 'ico-xs')));
  }
  function Newsletter() {
    const [tab, setTab] = React.useState('compor');
    const [accounts, setAccounts] = React.useState(() => D.instaAccounts.map(a => a.incluido));
    const initialSel = D.instaPosts.filter(p => {
      const acc = D.instaAccounts.find(a => a.handle === p.conta);
      return acc && acc.incluido;
    }).slice(0, 3).map(p => p.id);
    const [sel, setSel] = React.useState(initialSel);
    const [titulo, setTitulo] = React.useState('Oportunidades da semana · 16 jun');
    const includedHandles = D.instaAccounts.filter((a, i) => accounts[i]).map(a => a.handle);
    const visiblePosts = D.instaPosts.filter(p => includedHandles.indexOf(p.conta) !== -1);
    const toggleAcc = i => setAccounts(s => s.map((v, j) => j === i ? !v : v));
    const togglePost = id => setSel(s => s.indexOf(id) !== -1 ? s.filter(x => x !== id) : s.concat(id));
    const selectedPosts = D.instaPosts.filter(p => sel.indexOf(p.id) !== -1);
    const generate = () => setSel(visiblePosts.map(p => p.id));
    const tabs = [{
      value: 'compor',
      label: 'Compor'
    }, {
      value: 'anteriores',
      label: 'Edições anteriores'
    }];
    if (tab === 'anteriores') {
      const cols = [{
        key: 'titulo',
        header: 'Edição'
      }, {
        key: 'status',
        header: 'Status'
      }, {
        key: 'data',
        header: 'Data'
      }, {
        key: 'destinatarios',
        header: 'Destinatários',
        align: 'right'
      }, {
        key: 'aberturas',
        header: 'Aberturas',
        align: 'right'
      }, {
        key: 'itens',
        header: 'Itens',
        align: 'right'
      }];
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }
      }, /*#__PURE__*/React.createElement(Tabs, {
        items: tabs,
        value: tab,
        onChange: setTab
      }), /*#__PURE__*/React.createElement(Card, {
        flat: true
      }, /*#__PURE__*/React.createElement(Table, {
        columns: cols,
        data: D.newsletters,
        renderCell: (r, c) => {
          if (c.key === 'titulo') return /*#__PURE__*/React.createElement("span", {
            style: {
              fontWeight: 600
            }
          }, r.titulo);
          if (c.key === 'status') return /*#__PURE__*/React.createElement(Badge, {
            variant: D.newsletterStatusVariant[r.status],
            dot: true
          }, r.status);
          if (c.key === 'aberturas') return /*#__PURE__*/React.createElement("span", {
            style: {
              fontWeight: 600,
              color: r.aberturas !== '—' ? 'var(--success)' : 'var(--muted-foreground)'
            }
          }, r.aberturas);
          return r[c.key];
        }
      })));
    }
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      items: tabs,
      value: tab,
      onChange: setTab
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr',
        gap: 22,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 8
      }
    }, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        fontSize: 15,
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }
    }, Ic('instagram', 'ico-sm'), " Contas do Instagram"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconLeft: Ic('plus', 'ico-xs')
    }, "Conectar")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8
      }
    }, D.instaAccounts.map((a, i) => /*#__PURE__*/React.createElement(Account, {
      key: a.id,
      a: a,
      on: accounts[i],
      onToggle: () => toggleAcc(i)
    }))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 8
      }
    }, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        fontSize: 15
      }
    }, "Posts recentes"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('sparkles', 'ico-xs'),
      onClick: generate
    }, "Gerar com tudo")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingTop: 8
      }
    }, visiblePosts.map(p => {
      const on = sel.indexOf(p.id) !== -1;
      const acc = D.instaAccounts.find(a => a.handle === p.conta);
      return /*#__PURE__*/React.createElement("div", {
        key: p.id,
        onClick: () => togglePost(p.id),
        style: {
          display: 'flex',
          gap: 12,
          padding: 12,
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
          background: on ? 'var(--azul-soft)' : 'var(--card)'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 34,
          height: 34,
          flex: 'none',
          borderRadius: '50%',
          background: acc ? acc.cor : 'var(--azul)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          fontSize: 13
        }
      }, p.conta.charAt(1).toUpperCase()), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 2
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12.5,
          fontWeight: 600
        }
      }, p.conta), /*#__PURE__*/React.createElement(Badge, {
        variant: "neutral"
      }, p.tipo), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 11.5,
          color: 'var(--muted-foreground)'
        }
      }, "\xB7 ", p.quando)), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: 'var(--neutral-700)',
          lineHeight: 1.4
        }
      }, p.resumo), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11.5,
          color: 'var(--muted-foreground)',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 5
        }
      }, Ic('heart', 'ico-xs'), " ", p.curtidas, " \xB7 ", p.oportunidade)), /*#__PURE__*/React.createElement("span", {
        style: {
          color: on ? 'var(--azul)' : 'var(--neutral-300)',
          flex: 'none'
        }
      }, Ic(on ? 'check-circle-2' : 'circle', 'ico-sm')));
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'sticky',
        top: 84
      }
    }, /*#__PURE__*/React.createElement(Card, {
      style: {
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--ink)',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/icon-branco.png",
      alt: "",
      style: {
        width: 28,
        height: 28,
        borderRadius: '50%'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 16,
        color: '#fff'
      }
    }, "Access", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--grifa-texto)'
      }
    }, "+"), "Plus"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 11,
        color: 'var(--sidebar-muted)',
        textTransform: 'uppercase',
        letterSpacing: '.1em'
      }
    }, "Newsletter")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("input", {
      value: titulo,
      onChange: e => setTitulo(e.target.value),
      className: "ap-input",
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 18,
        border: '1px dashed var(--border)'
      }
    }), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13.5,
        color: 'var(--neutral-700)',
        margin: 0,
        lineHeight: 1.5
      }
    }, "Oi! Separamos as melhores oportunidades da semana pra voc\xEA que busca as pr\xF3prias oportunidades. \uD83D\uDC47"), selectedPosts.length === 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 20,
        textAlign: 'center',
        color: 'var(--muted-foreground)',
        fontSize: 13,
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-md)'
      }
    }, "Selecione posts ao lado para montar a edi\xE7\xE3o."), selectedPosts.map((p, i) => /*#__PURE__*/React.createElement("div", {
      key: p.id,
      style: {
        display: 'flex',
        gap: 12,
        paddingBottom: 14,
        borderBottom: i < selectedPosts.length - 1 ? '1px solid var(--neutral-100)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 30,
        height: 30,
        flex: 'none',
        borderRadius: 8,
        background: 'var(--azul-soft)',
        color: 'var(--azul)',
        fontWeight: 800,
        fontFamily: 'var(--font-display)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13
      }
    }, i + 1), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        fontFamily: 'var(--font-display)'
      }
    }, p.oportunidade), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--neutral-700)',
        marginTop: 2,
        lineHeight: 1.4
      }
    }, p.resumo), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--azul)',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginTop: 4
      }
    }, "Ver oportunidade ", Ic('arrow-right', 'ico-xs'))))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--muted-foreground)',
        textAlign: 'center',
        paddingTop: 4
      }
    }, "Access+Plus \xB7 voc\xEA recebe porque se inscreveu \xB7 descadastrar"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: 'var(--muted-foreground)',
        flex: 1
      }
    }, selectedPosts.length, " itens \xB7 ~9.412 destinat\xE1rios"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('save', 'ico-xs')
    }, "Rascunho"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('calendar-clock', 'ico-xs')
    }, "Agendar"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "sm",
      iconLeft: Ic('send', 'ico-xs')
    }, "Publicar")))));
  }
  window.Newsletter = Newsletter;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Newsletter.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Opportunities.jsx
try { (() => {
// Opportunities (Oportunidades) — list + horizontal dropdown filters
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Card,
    Badge,
    Button,
    Input,
    Select,
    Checkbox
  } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  const emptySel = () => ({
    tipo: [],
    nivel: [],
    publico: [],
    custo: [],
    interesse: [],
    inscricoes: null
  });

  // ---- Single horizontal filter dropdown ----
  function FilterDropdown({
    f,
    sel,
    onToggle,
    onRadio,
    openKey,
    setOpenKey
  }) {
    const open = openKey === f.key;
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const onDoc = e => {
        if (ref.current && !ref.current.contains(e.target)) setOpenKey(null);
      };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    const count = f.type === 'radio' ? sel.inscricoes ? 1 : 0 : sel[f.key].length;
    const active = count > 0;
    return /*#__PURE__*/React.createElement("div", {
      ref: ref,
      style: {
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpenKey(open ? null : f.key),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        cursor: 'pointer',
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-body)',
        fontSize: 13.5,
        fontWeight: 600,
        border: '1px solid ' + (active || open ? 'var(--azul)' : 'var(--border)'),
        background: active ? 'var(--azul-soft)' : 'var(--card)',
        color: active ? 'var(--azul)' : 'var(--ink)',
        whiteSpace: 'nowrap',
        transition: 'border-color .12s ease, background-color .12s ease'
      }
    }, f.label, active && /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        fontSize: 11,
        fontWeight: 700,
        background: 'var(--azul)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, count), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform .14s ease'
      }
    }, Ic('chevron-down', 'ico-xs'))), open && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 30,
        minWidth: 224,
        maxHeight: 320,
        overflowY: 'auto',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg, 0 12px 28px rgba(14,0,51,0.16))',
        padding: '12px 14px'
      }
    }, f.type === 'radio' ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, f.options.map(o => {
      const on = sel.inscricoes === o;
      return /*#__PURE__*/React.createElement("button", {
        key: o,
        onClick: () => onRadio(f.key, on ? null : o),
        style: {
          flex: 1,
          padding: '7px 0',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
          background: on ? 'var(--azul-soft)' : 'var(--card)',
          color: on ? 'var(--azul)' : 'var(--ink)'
        }
      }, o);
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, f.options.map(o => /*#__PURE__*/React.createElement(Checkbox, {
      key: o,
      label: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13.5
        }
      }, o),
      checked: sel[f.key].indexOf(o) !== -1,
      onChange: () => onToggle(f.key, o)
    })))));
  }
  function Opportunities({
    onOpen,
    onNew,
    onEdit
  }) {
    const [q, setQ] = React.useState('');
    const [sel, setSel] = React.useState(emptySel);
    const [openKey, setOpenKey] = React.useState(null);
    const toggle = (k, o) => setSel(s => {
      const arr = s[k];
      const next = arr.indexOf(o) !== -1 ? arr.filter(x => x !== o) : arr.concat(o);
      return Object.assign({}, s, {
        [k]: next
      });
    });
    const radio = (k, v) => setSel(s => Object.assign({}, s, {
      [k]: v
    }));
    const clear = () => {
      setSel(emptySel());
      setQ('');
    };
    const inter = (a, b) => a.some(x => b.indexOf(x) !== -1);
    let rows = D.opportunities.filter(o => {
      if (q && !(o.titulo.toLowerCase().includes(q.toLowerCase()) || o.org.toLowerCase().includes(q.toLowerCase()))) return false;
      if (sel.tipo.length && sel.tipo.indexOf(o.tipo) === -1) return false;
      if (sel.custo.length && sel.custo.indexOf(o.custo) === -1) return false;
      if (sel.nivel.length && !inter(sel.nivel, o.nivel)) return false;
      if (sel.publico.length && !inter(sel.publico, o.publico)) return false;
      if (sel.interesse.length && !inter(sel.interesse, o.interesse)) return false;
      if (sel.inscricoes === 'Sim' && !o.inscricoesAbertas) return false;
      if (sel.inscricoes === 'Não' && o.inscricoesAbertas) return false;
      return true;
    });
    const activeCount = sel.tipo.length + sel.nivel.length + sel.publico.length + sel.custo.length + sel.interesse.length + (sel.inscricoes ? 1 : 0);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 220
      }
    }, /*#__PURE__*/React.createElement(Input, {
      placeholder: "Buscar oportunidade\u2026",
      icon: Ic('search', 'ico-sm'),
      value: q,
      onChange: e => setQ(e.target.value)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 180
      }
    }, /*#__PURE__*/React.createElement(Select, {
      defaultValue: "recentes"
    }, /*#__PURE__*/React.createElement("option", {
      value: "recentes"
    }, "Mais recentes"), /*#__PURE__*/React.createElement("option", {
      value: "prazo"
    }, "Prazo mais pr\xF3ximo"), /*#__PURE__*/React.createElement("option", {
      value: "alfabetica"
    }, "Ordem alfab\xE9tica")))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        color: 'var(--muted-foreground)',
        fontSize: 12.5,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.06em'
      }
    }, Ic('sliders-horizontal', 'ico-sm'), " Filtros"), D.filters.map(f => /*#__PURE__*/React.createElement(FilterDropdown, {
      key: f.key,
      f: f,
      sel: sel,
      onToggle: toggle,
      onRadio: radio,
      openKey: openKey,
      setOpenKey: setOpenKey
    })), activeCount > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: clear,
      className: "link-cell",
      style: {
        fontSize: 12.5,
        color: 'var(--azul)',
        fontWeight: 600,
        padding: '6px 4px'
      }
    }, "Limpar filtros")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--muted-foreground)'
      }
    }, rows.length, " ", rows.length === 1 ? 'oportunidade' : 'oportunidades', activeCount ? ' · ' + activeCount + ' filtro(s)' : ''), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0
      }
    }, rows.map(o => /*#__PURE__*/React.createElement(Card, {
      key: o.id,
      interactive: true,
      onClick: () => onOpen(o)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 16,
        padding: '18px 20px',
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
      }
    }, o.destaque && Ic('star', 'ico-star'), /*#__PURE__*/React.createElement("h3", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: '-0.01em'
      }
    }, o.titulo)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--muted-foreground)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, Ic('building-2', 'ico-xs'), " ", o.org, " \xB7 ", o.areaAtuacao), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      variant: D.tipoVariant[o.tipo] || 'neutral'
    }, o.tipo), /*#__PURE__*/React.createElement(Badge, {
      variant: D.custoVariant[o.custo] || 'neutral'
    }, o.custo), o.nivel.map(n => /*#__PURE__*/React.createElement(Badge, {
      key: n,
      variant: "neutral"
    }, n)), o.publico.slice(0, 2).map(p => /*#__PURE__*/React.createElement(Badge, {
      key: p,
      variant: "pink"
    }, p)))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
        width: 168
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      variant: D.statusVariant[o.status],
      dot: true
    }, o.status), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--muted-foreground)',
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        justifyContent: 'flex-end'
      }
    }, Ic('calendar', 'ico-xs'), " ", o.prazo), o.comentarios && o.comentarios.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        justifyContent: 'flex-end',
        marginTop: 3
      }
    }, Ic('message-circle', 'ico-xs'), " ", o.comentarios.length, " coment\xE1rio(s)")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: () => onEdit(o),
      iconLeft: Ic('pencil', 'ico-xs')
    }, "Editar"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "icon",
      "aria-label": "Ver",
      onClick: () => onOpen(o),
      style: {
        width: 34,
        height: 34
      }
    }, Ic('arrow-up-right', 'ico-sm'))))))), rows.length === 0 && /*#__PURE__*/React.createElement(Card, {
      flat: true
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 48,
        textAlign: 'center',
        color: 'var(--muted-foreground)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'center'
      }
    }, Ic('search-x', 'ico')), "Nenhuma oportunidade encontrada com esses filtros.", /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      onClick: clear
    }, "Limpar filtros"))))));
  }
  window.Opportunities = Opportunities;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Opportunities.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/OpportunityDetail.jsx
try { (() => {
// OpportunityDetail — full opportunity page (admin view)
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Badge,
    Button,
    Dialog
  } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  const PLAT = {
    youtube: {
      label: 'YouTube',
      icon: 'youtube',
      color: '#FF0000'
    },
    instagram: {
      label: 'Instagram',
      icon: 'instagram',
      color: 'var(--grifa-topicos)'
    },
    reddit: {
      label: 'Reddit',
      icon: 'message-circle',
      color: '#FF4500'
    }
  };
  function Section({
    icon,
    title,
    children
  }) {
    return /*#__PURE__*/React.createElement(Card, {
      flat: true
    }, /*#__PURE__*/React.createElement(CardHeader, {
      style: {
        paddingBottom: 6
      }
    }, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--azul)'
      }
    }, Ic(icon, 'ico-sm')), title)), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 10
      }
    }, children));
  }
  function Fact({
    icon,
    label,
    value
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--muted-foreground)',
        marginTop: 1
      }
    }, Ic(icon, 'ico-sm')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        fontWeight: 600
      }
    }, value)));
  }
  function OpportunityDetail({
    opp,
    onBack,
    onEdit,
    onDelete,
    onTogglePublish
  }) {
    const [confirm, setConfirm] = React.useState(false);
    const [comentarios, setComentarios] = React.useState(() => opp && opp.comentarios || []);
    const [delId, setDelId] = React.useState(null);
    React.useEffect(() => {
      setComentarios(opp && opp.comentarios || []);
    }, [opp && opp.id]);
    if (!opp) return null;
    const removeComment = id => {
      const next = comentarios.filter(c => c.id !== id);
      setComentarios(next);
      opp.comentarios = next;
      setDelId(null);
    };
    const published = opp.status === 'Publicada';
    const para = {
      fontSize: 14.5,
      lineHeight: 1.6,
      color: 'var(--neutral-700)'
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconLeft: Ic('arrow-left', 'ico-sm'),
      onClick: onBack
    }, "Oportunidades"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      iconLeft: Ic('pencil', 'ico-sm'),
      onClick: () => onEdit(opp)
    }, "Editar"), /*#__PURE__*/React.createElement(Button, {
      variant: published ? 'secondary' : 'primary',
      iconLeft: Ic(published ? 'eye-off' : 'send', 'ico-sm'),
      onClick: () => onTogglePublish(opp)
    }, published ? 'Despublicar' : 'Publicar'), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "icon",
      "aria-label": "Excluir",
      onClick: () => setConfirm(true),
      style: {
        color: 'var(--vermelha)'
      }
    }, Ic('trash-2', 'ico-sm'))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12
      }
    }, opp.destaque && /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 4
      }
    }, Ic('star', 'ico-star')), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 28,
        letterSpacing: '-0.02em',
        lineHeight: 1.1
      }
    }, opp.titulo), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: 'var(--muted-foreground)',
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 7
      }
    }, Ic('building-2', 'ico-sm'), " ", opp.org)), /*#__PURE__*/React.createElement(Badge, {
      variant: D.statusVariant[opp.status],
      dot: true
    }, opp.status)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      variant: D.tipoVariant[opp.tipo] || 'neutral'
    }, opp.tipo), /*#__PURE__*/React.createElement(Badge, {
      variant: D.custoVariant[opp.custo] || 'neutral'
    }, opp.custo), /*#__PURE__*/React.createElement(Badge, {
      variant: opp.inscricoesAbertas ? 'success' : 'neutral',
      dot: true
    }, opp.inscricoesAbertas ? 'Inscrições abertas' : 'Inscrições fechadas'), opp.interesse.map(i => /*#__PURE__*/React.createElement(Badge, {
      key: i,
      variant: "lime"
    }, i))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.7fr 1fr',
        gap: 20,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(Section, {
      icon: "align-left",
      title: "Descri\xE7\xE3o"
    }, /*#__PURE__*/React.createElement("p", {
      style: para
    }, opp.descricao)), /*#__PURE__*/React.createElement(Section, {
      icon: "clipboard-check",
      title: "Elegibilidade e guia de aplica\xE7\xE3o"
    }, /*#__PURE__*/React.createElement("ul", {
      style: {
        margin: 0,
        paddingLeft: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, opp.elegibilidade.map((e, i) => /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        display: 'flex',
        gap: 10,
        ...para
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--azul)',
        marginTop: 2
      }
    }, Ic('check', 'ico-sm')), e)))), /*#__PURE__*/React.createElement(Section, {
      icon: "route",
      title: "Sobre o processo"
    }, /*#__PURE__*/React.createElement("p", {
      style: para
    }, opp.processo)), /*#__PURE__*/React.createElement(Section, {
      icon: "lightbulb",
      title: "Dicas de contemplados"
    }, /*#__PURE__*/React.createElement("ul", {
      style: {
        margin: 0,
        paddingLeft: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, opp.dicas.map((d, i) => /*#__PURE__*/React.createElement("li", {
      key: i,
      style: {
        display: 'flex',
        gap: 10,
        ...para
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--grifa-topicos)',
        marginTop: 2
      }
    }, Ic('sparkles', 'ico-sm')), d)))), /*#__PURE__*/React.createElement(Section, {
      icon: "info",
      title: "Informa\xE7\xF5es adicionais"
    }, /*#__PURE__*/React.createElement("p", {
      style: para
    }, opp.infoAdicional)), /*#__PURE__*/React.createElement(Section, {
      icon: "link",
      title: "Recursos online"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, opp.recursos.map((r, i) => {
      const p = PLAT[r.plataforma] || PLAT.instagram;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          padding: 12,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          width: 40,
          height: 40,
          flex: 'none',
          borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, ' + p.color + ' 14%, white)',
          color: p.color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }, Ic(p.icon, 'ico')), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 14,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }
      }, r.titulo), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12,
          color: 'var(--muted-foreground)'
        }
      }, p.label, " \xB7 ", r.meta)), /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        size: "icon",
        "aria-label": "Abrir",
        style: {
          width: 34,
          height: 34
        }
      }, Ic('external-link', 'ico-sm')));
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('plus', 'ico-xs'),
      style: {
        alignSelf: 'flex-start'
      }
    }, "Conectar recurso (YouTube \xB7 Reddit \xB7 Instagram)"))), /*#__PURE__*/React.createElement(Section, {
      icon: "tags",
      title: "Tags relacionadas"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7
      }
    }, opp.tagsRelacionadas.map(t => /*#__PURE__*/React.createElement(Badge, {
      key: t,
      variant: "neutral"
    }, "#", t)))), /*#__PURE__*/React.createElement(Card, {
      flat: true
    }, /*#__PURE__*/React.createElement(CardHeader, {
      style: {
        paddingBottom: 6
      }
    }, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        fontSize: 16
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--azul)'
      }
    }, Ic('message-circle', 'ico-sm')), "Coment\xE1rios dos estudantes", /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--muted-foreground)'
      }
    }, "(", comentarios.length, ")"))), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 10
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12.5,
        color: 'var(--muted-foreground)',
        marginTop: 0,
        marginBottom: 16
      }
    }, "Coment\xE1rios p\xFAblicos enviados pelos estudantes. Remova qualquer um que seja inadequado, spam ou ofensivo."), comentarios.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '28px 0',
        textAlign: 'center',
        color: 'var(--muted-foreground)',
        fontSize: 13.5
      }
    }, "Ainda n\xE3o h\xE1 coment\xE1rios nesta oportunidade.") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, comentarios.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        display: 'flex',
        gap: 12,
        padding: 14,
        borderRadius: 'var(--radius-md)',
        border: '1px solid ' + (c.sinalizado ? 'var(--vermelha)' : 'var(--border)'),
        background: c.sinalizado ? 'var(--vermelha-soft)' : 'var(--card)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 36,
        height: 36,
        flex: 'none',
        borderRadius: '50%',
        background: c.cor,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12.5,
        fontWeight: 700,
        fontFamily: 'var(--font-display)'
      }
    }, c.iniciais), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 700
      }
    }, c.autor), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--muted-foreground)'
      }
    }, c.quando), c.sinalizado && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--vermelha)'
      }
    }, Ic('flag', 'ico-xs'), " Sinalizado")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13.5,
        lineHeight: 1.5,
        color: 'var(--neutral-700)',
        margin: 0
      }
    }, c.texto)), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "icon",
      "aria-label": "Excluir coment\xE1rio",
      onClick: () => setDelId(c.id),
      style: {
        flex: 'none',
        width: 34,
        height: 34,
        color: 'var(--vermelha)'
      }
    }, Ic('trash-2', 'ico-sm')))))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        position: 'sticky',
        top: 84
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        fontSize: 15
      }
    }, "Resumo")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        paddingTop: 10
      }
    }, /*#__PURE__*/React.createElement(Fact, {
      icon: "calendar",
      label: "Prazo de inscri\xE7\xE3o",
      value: opp.prazo
    }), /*#__PURE__*/React.createElement(Fact, {
      icon: "play",
      label: "In\xEDcio",
      value: opp.dataInicio
    }), /*#__PURE__*/React.createElement(Fact, {
      icon: "bar-chart-3",
      label: "N\xEDvel",
      value: opp.nivel.join(' · ')
    }), /*#__PURE__*/React.createElement(Fact, {
      icon: "wallet",
      label: "Custo",
      value: opp.custo
    }), /*#__PURE__*/React.createElement(Fact, {
      icon: "monitor",
      label: "Formato",
      value: opp.formato
    }), /*#__PURE__*/React.createElement(Fact, {
      icon: "map-pin",
      label: "Local",
      value: opp.local
    }), /*#__PURE__*/React.createElement(Fact, {
      icon: "target",
      label: "\xC1rea de atua\xE7\xE3o",
      value: opp.areaAtuacao
    }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        fontSize: 15
      }
    }, "P\xFAblico-alvo")), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7
      }
    }, opp.publico.map(p => /*#__PURE__*/React.createElement(Badge, {
      key: p,
      variant: "pink"
    }, p))))))), /*#__PURE__*/React.createElement(Dialog, {
      open: confirm,
      onClose: () => setConfirm(false),
      title: "Excluir oportunidade?",
      description: "Esta a\xE7\xE3o n\xE3o pode ser desfeita.",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => setConfirm(false)
      }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
        variant: "destructive",
        iconLeft: Ic('trash-2', 'ico-sm'),
        onClick: () => {
          setConfirm(false);
          onDelete(opp);
        }
      }, "Excluir"))
    }, "\u201C", opp.titulo, "\u201D ser\xE1 removida permanentemente do painel."), /*#__PURE__*/React.createElement(Dialog, {
      open: !!delId,
      onClose: () => setDelId(null),
      title: "Excluir coment\xE1rio?",
      description: "O coment\xE1rio ser\xE1 removido para todos os estudantes.",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => setDelId(null)
      }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
        variant: "destructive",
        iconLeft: Ic('trash-2', 'ico-sm'),
        onClick: () => removeComment(delId)
      }, "Excluir coment\xE1rio"))
    }, "Esta a\xE7\xE3o n\xE3o pode ser desfeita."));
  }
  window.OpportunityDetail = OpportunityDetail;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/OpportunityDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/OpportunityEditor.jsx
try { (() => {
// OpportunityEditor — create / edit / publish / delete
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Button,
    Input,
    Textarea,
    Select,
    Field,
    Switch,
    Badge,
    Dialog
  } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  function Chips({
    options,
    value,
    onToggle,
    variant
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8
      }
    }, options.map(o => {
      const on = value.indexOf(o) !== -1;
      return /*#__PURE__*/React.createElement("button", {
        key: o,
        type: "button",
        onClick: () => onToggle(o),
        style: {
          padding: '7px 13px',
          borderRadius: 'var(--radius-pill)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid ' + (on ? 'var(--azul)' : 'var(--border)'),
          background: on ? 'var(--azul)' : 'var(--card)',
          color: on ? '#fff' : 'var(--ink)',
          transition: 'all .12s ease'
        }
      }, o);
    }));
  }
  function EditorSection({
    title,
    children
  }) {
    return /*#__PURE__*/React.createElement(Card, {
      flat: true
    }, /*#__PURE__*/React.createElement(CardHeader, {
      style: {
        paddingBottom: 4
      }
    }, /*#__PURE__*/React.createElement(CardTitle, {
      style: {
        fontSize: 16
      }
    }, title)), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        paddingTop: 12
      }
    }, children));
  }
  function OpportunityEditor({
    opp,
    onCancel,
    onSave,
    onDelete
  }) {
    const isNew = !opp;
    const get = (k, d) => opp && opp[k] != null ? opp[k] : d;
    const [form, setForm] = React.useState({
      titulo: get('titulo', ''),
      org: get('org', ''),
      tipo: get('tipo', 'Bolsas de Estudo'),
      areaAtuacao: get('areaAtuacao', ''),
      custo: get('custo', 'Gratuito'),
      formato: get('formato', 'Online'),
      local: get('local', ''),
      prazo: get('prazo', ''),
      dataInicio: get('dataInicio', ''),
      nivel: get('nivel', []),
      publico: get('publico', []),
      interesse: get('interesse', []),
      inscricoesAbertas: get('inscricoesAbertas', true),
      destaque: get('destaque', false),
      descricao: get('descricao', ''),
      elegibilidade: (get('elegibilidade', []) || []).join('\n'),
      processo: get('processo', ''),
      dicas: (get('dicas', []) || []).join('\n'),
      infoAdicional: get('infoAdicional', ''),
      tags: (get('tagsRelacionadas', []) || []).join(', ')
    });
    const [confirm, setConfirm] = React.useState(false);
    const set = (k, v) => setForm(f => Object.assign({}, f, {
      [k]: v
    }));
    const toggleIn = k => o => set(k, form[k].indexOf(o) !== -1 ? form[k].filter(x => x !== o) : form[k].concat(o));
    const F = key => D.filters.find(f => f.key === key).options;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        maxWidth: 860
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconLeft: Ic('arrow-left', 'ico-sm'),
      onClick: onCancel
    }, "Voltar"), /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 22,
        letterSpacing: '-0.02em'
      }
    }, isNew ? 'Nova oportunidade' : 'Editar oportunidade'), !isNew && /*#__PURE__*/React.createElement(Badge, {
      variant: D.statusVariant[opp.status],
      dot: true
    }, opp.status)), /*#__PURE__*/React.createElement(EditorSection, {
      title: "Informa\xE7\xF5es b\xE1sicas"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "T\xEDtulo da oportunidade",
      htmlFor: "ed-t"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-t",
      value: form.titulo,
      onChange: e => set('titulo', e.target.value),
      placeholder: "Ex.: Olimp\xEDada Brasileira de Matem\xE1tica"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Organiza\xE7\xE3o",
      htmlFor: "ed-o"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-o",
      value: form.org,
      onChange: e => set('org', e.target.value)
    })), /*#__PURE__*/React.createElement(Field, {
      label: "\xC1rea de atua\xE7\xE3o",
      htmlFor: "ed-a"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-a",
      value: form.areaAtuacao,
      onChange: e => set('areaAtuacao', e.target.value),
      placeholder: "Ex.: Matem\xE1tica"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Tipo",
      htmlFor: "ed-tp"
    }, /*#__PURE__*/React.createElement(Select, {
      id: "ed-tp",
      value: form.tipo,
      onChange: e => set('tipo', e.target.value)
    }, F('tipo').map(o => /*#__PURE__*/React.createElement("option", {
      key: o
    }, o)))), /*#__PURE__*/React.createElement(Field, {
      label: "Custo",
      htmlFor: "ed-c"
    }, /*#__PURE__*/React.createElement(Select, {
      id: "ed-c",
      value: form.custo,
      onChange: e => set('custo', e.target.value)
    }, F('custo').map(o => /*#__PURE__*/React.createElement("option", {
      key: o
    }, o)))))), /*#__PURE__*/React.createElement(EditorSection, {
      title: "Classifica\xE7\xE3o"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "N\xEDvel"
    }, /*#__PURE__*/React.createElement(Chips, {
      options: F('nivel'),
      value: form.nivel,
      onToggle: toggleIn('nivel')
    })), /*#__PURE__*/React.createElement(Field, {
      label: "P\xFAblico-alvo"
    }, /*#__PURE__*/React.createElement(Chips, {
      options: F('publico'),
      value: form.publico,
      onToggle: toggleIn('publico')
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Interesse"
    }, /*#__PURE__*/React.createElement(Chips, {
      options: F('interesse'),
      value: form.interesse,
      onToggle: toggleIn('interesse')
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        background: 'var(--neutral-50)',
        borderRadius: 'var(--radius-md)'
      }
    }, /*#__PURE__*/React.createElement(Switch, {
      label: "Inscri\xE7\xF5es abertas",
      checked: form.inscricoesAbertas,
      onChange: e => set('inscricoesAbertas', e.target.checked)
    }), /*#__PURE__*/React.createElement(Switch, {
      label: "Destacar na home",
      checked: form.destaque,
      onChange: e => set('destaque', e.target.checked)
    }))), /*#__PURE__*/React.createElement(EditorSection, {
      title: "Datas e formato"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Prazo de inscri\xE7\xE3o",
      htmlFor: "ed-p"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-p",
      value: form.prazo,
      onChange: e => set('prazo', e.target.value),
      placeholder: "Ex.: 30 jun 2026"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "In\xEDcio",
      htmlFor: "ed-i"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-i",
      value: form.dataInicio,
      onChange: e => set('dataInicio', e.target.value),
      placeholder: "Ex.: Provas a partir de set 2026"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Formato",
      htmlFor: "ed-f"
    }, /*#__PURE__*/React.createElement(Select, {
      id: "ed-f",
      value: form.formato,
      onChange: e => set('formato', e.target.value)
    }, /*#__PURE__*/React.createElement("option", null, "Online"), /*#__PURE__*/React.createElement("option", null, "Presencial"), /*#__PURE__*/React.createElement("option", null, "H\xEDbrido"))), /*#__PURE__*/React.createElement(Field, {
      label: "Local",
      htmlFor: "ed-l"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-l",
      value: form.local,
      onChange: e => set('local', e.target.value),
      placeholder: "Ex.: Nacional"
    })))), /*#__PURE__*/React.createElement(EditorSection, {
      title: "Conte\xFAdo"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Descri\xE7\xE3o",
      htmlFor: "ed-d"
    }, /*#__PURE__*/React.createElement(Textarea, {
      id: "ed-d",
      rows: 3,
      value: form.descricao,
      onChange: e => set('descricao', e.target.value),
      placeholder: "Explique, em linguagem simples, para quem \xE9 a oportunidade."
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Elegibilidade e guia de aplica\xE7\xE3o",
      htmlFor: "ed-el",
      hint: "Um item por linha."
    }, /*#__PURE__*/React.createElement(Textarea, {
      id: "ed-el",
      rows: 3,
      value: form.elegibilidade,
      onChange: e => set('elegibilidade', e.target.value)
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Sobre o processo",
      htmlFor: "ed-pr"
    }, /*#__PURE__*/React.createElement(Textarea, {
      id: "ed-pr",
      rows: 3,
      value: form.processo,
      onChange: e => set('processo', e.target.value)
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Dicas de contemplados",
      htmlFor: "ed-di",
      hint: "Um item por linha."
    }, /*#__PURE__*/React.createElement(Textarea, {
      id: "ed-di",
      rows: 3,
      value: form.dicas,
      onChange: e => set('dicas', e.target.value)
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Informa\xE7\xF5es adicionais",
      htmlFor: "ed-ia"
    }, /*#__PURE__*/React.createElement(Textarea, {
      id: "ed-ia",
      rows: 2,
      value: form.infoAdicional,
      onChange: e => set('infoAdicional', e.target.value)
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Tags relacionadas",
      htmlFor: "ed-tg",
      hint: "Separadas por v\xEDrgula."
    }, /*#__PURE__*/React.createElement(Input, {
      id: "ed-tg",
      value: form.tags,
      onChange: e => set('tags', e.target.value)
    }))), /*#__PURE__*/React.createElement(EditorSection, {
      title: "Recursos online"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 13.5,
        color: 'var(--muted-foreground)',
        margin: 0
      }
    }, "Conecte v\xEDdeos, discuss\xF5es e posts das contas oficiais. As pr\xE9vias s\xE3o geradas automaticamente."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('youtube', 'ico-sm')
    }, "Adicionar YouTube"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('message-circle', 'ico-sm')
    }, "Adicionar Reddit"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: Ic('instagram', 'ico-sm')
    }, "Adicionar Instagram"))), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'sticky',
        bottom: 0,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '14px 16px',
        background: 'rgba(255,255,255,.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)'
      }
    }, !isNew && /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      iconLeft: Ic('trash-2', 'ico-sm'),
      style: {
        color: 'var(--vermelha)'
      },
      onClick: () => setConfirm(true)
    }, "Excluir"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: onCancel
    }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      iconLeft: Ic('save', 'ico-sm'),
      onClick: () => onSave(form, 'Rascunho')
    }, "Salvar rascunho"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconLeft: Ic('send', 'ico-sm'),
      onClick: () => onSave(form, 'Publicada')
    }, "Publicar")), /*#__PURE__*/React.createElement(Dialog, {
      open: confirm,
      onClose: () => setConfirm(false),
      title: "Excluir oportunidade?",
      description: "Esta a\xE7\xE3o n\xE3o pode ser desfeita.",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => setConfirm(false)
      }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
        variant: "destructive",
        iconLeft: Ic('trash-2', 'ico-sm'),
        onClick: () => {
          setConfirm(false);
          onDelete(opp);
        }
      }, "Excluir"))
    }, "\u201C", form.titulo || 'Esta oportunidade', "\u201D ser\xE1 removida permanentemente."));
  }
  window.OpportunityEditor = OpportunityEditor;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/OpportunityEditor.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/Team.jsx
try { (() => {
// Team (Membros do time)
(function () {
  const NS = window.AccessPlusDesignSystem_ece1f0;
  const {
    Card,
    Table,
    Badge,
    Button,
    Avatar,
    Input,
    Select,
    Field,
    Dialog
  } = NS;
  const D = window.AP_DATA;
  const Ic = (n, cls) => window.Ic(n, cls);
  function Team() {
    const [q, setQ] = React.useState('');
    const [invite, setInvite] = React.useState(false);
    let rows = D.team;
    if (q) rows = rows.filter(m => m.nome.toLowerCase().includes(q.toLowerCase()) || m.email.toLowerCase().includes(q.toLowerCase()) || m.cargo.toLowerCase().includes(q.toLowerCase()));
    const cols = [{
      key: 'nome',
      header: 'Membro'
    }, {
      key: 'cargo',
      header: 'Função'
    }, {
      key: 'papel',
      header: 'Permissão'
    }, {
      key: 'status',
      header: 'Status'
    }, {
      key: 'acoes',
      header: '',
      align: 'right',
      width: 90
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 280
      }
    }, /*#__PURE__*/React.createElement(Input, {
      placeholder: "Buscar membro\u2026",
      icon: Ic('search', 'ico-sm'),
      value: q,
      onChange: e => setQ(e.target.value)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconLeft: Ic('user-plus', 'ico-sm'),
      onClick: () => setInvite(true)
    }, "Convidar membro")), /*#__PURE__*/React.createElement(Card, {
      flat: true
    }, /*#__PURE__*/React.createElement(Table, {
      columns: cols,
      data: rows,
      renderCell: (m, c) => {
        if (c.key === 'nome') return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 11
          }
        }, /*#__PURE__*/React.createElement(Avatar, {
          initials: m.iniciais,
          size: "md",
          color: m.cor
        }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
          style: {
            fontWeight: 600
          }
        }, m.nome), /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 12,
            color: 'var(--muted-foreground)'
          }
        }, m.email)));
        if (c.key === 'papel') return /*#__PURE__*/React.createElement(Badge, {
          variant: D.papelVariant[m.papel] || 'neutral'
        }, m.papel);
        if (c.key === 'status') return /*#__PURE__*/React.createElement(Badge, {
          variant: D.statusVariant[m.status],
          dot: true
        }, m.status);
        if (c.key === 'acoes') return /*#__PURE__*/React.createElement("div", {
          style: {
            display: 'flex',
            gap: 4,
            justifyContent: 'flex-end'
          },
          onClick: e => e.stopPropagation()
        }, /*#__PURE__*/React.createElement("button", {
          className: "row-action",
          "aria-label": "Editar permiss\xE3o"
        }, Ic('pencil', 'ico-sm')), /*#__PURE__*/React.createElement("button", {
          className: "row-action",
          "aria-label": "Remover"
        }, Ic('user-minus', 'ico-sm')));
        return m[c.key];
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: 'var(--muted-foreground)',
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, "Admin"), " \u2014 acesso total"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, "Editor"), " \u2014 cria e edita oportunidades"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, "Analista"), " \u2014 v\xEA dados e relat\xF3rios"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, "Viewer"), " \u2014 somente leitura")), /*#__PURE__*/React.createElement(Dialog, {
      open: invite,
      onClose: () => setInvite(false),
      width: 460,
      title: "Convidar membro",
      description: "Enviaremos um convite por e-mail para acessar o painel.",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        onClick: () => setInvite(false)
      }, "Cancelar"), /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        iconLeft: Ic('send', 'ico-sm'),
        onClick: () => setInvite(false)
      }, "Enviar convite"))
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Nome",
      htmlFor: "inv-n"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "inv-n",
      placeholder: "Nome completo"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "E-mail",
      htmlFor: "inv-e"
    }, /*#__PURE__*/React.createElement(Input, {
      id: "inv-e",
      type: "email",
      placeholder: "pessoa@accessplus.com.br"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Permiss\xE3o",
      htmlFor: "inv-p"
    }, /*#__PURE__*/React.createElement(Select, {
      id: "inv-p",
      defaultValue: "Editor"
    }, /*#__PURE__*/React.createElement("option", null, "Admin"), /*#__PURE__*/React.createElement("option", null, "Editor"), /*#__PURE__*/React.createElement("option", null, "Analista"), /*#__PURE__*/React.createElement("option", null, "Viewer"))))));
  }
  window.Team = Team;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/Team.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/data.js
try { (() => {
// Mock data for the Access+ admin UI kit (pt-BR).
window.AP_DATA = {
  nav: [{
    id: 'dashboard',
    label: 'Visão geral',
    icon: 'layout-dashboard'
  }, {
    id: 'oportunidades',
    label: 'Oportunidades',
    icon: 'compass'
  }, {
    id: 'newsletter',
    label: 'Newsletter',
    icon: 'mail'
  }, {
    id: 'time',
    label: 'Membros do time',
    icon: 'users-round'
  }],
  // ---- Filter taxonomy (drives the filter rail) ----
  filters: [{
    key: 'tipo',
    label: 'Tipo',
    type: 'check',
    options: ['Olimpíadas Científicas', 'MUNs', 'Programas Acadêmicos', 'Programas de Intercâmbio', 'Bolsas de Estudo', 'Competições', 'Competições de Escrita', 'Mentorias']
  }, {
    key: 'inscricoes',
    label: 'Inscrições abertas',
    type: 'radio',
    options: ['Sim', 'Não']
  }, {
    key: 'nivel',
    label: 'Nível',
    type: 'check',
    options: ['Fundamental', 'Ensino Médio', 'Gap']
  }, {
    key: 'publico',
    label: 'Público-alvo',
    type: 'check',
    options: ['Negros', 'LGBT', 'Baixa Renda', 'Indígenas', 'Deficientes', 'Meninas', 'Escola Pública']
  }, {
    key: 'custo',
    label: 'Custo',
    type: 'check',
    options: ['Bolsa', 'Gratuito', 'Totalmente Financiado']
  }, {
    key: 'interesse',
    label: 'Interesse',
    type: 'check',
    options: ['Meio Ambiente', 'Humanas', 'STEM', 'Linguagens', 'Artes']
  }],
  stats: [{
    label: 'Oportunidades publicadas',
    value: '86',
    icon: 'compass',
    delta: '+9',
    dir: 'up'
  }, {
    label: 'Inscrições abertas',
    value: '54',
    icon: 'door-open',
    delta: '+6',
    dir: 'up'
  }, {
    label: 'Rascunhos',
    value: '12',
    icon: 'file-pen',
    delta: '+3',
    dir: 'up'
  }, {
    label: 'Encerrando esta semana',
    value: '7',
    icon: 'clock',
    delta: '-2',
    dir: 'down'
  }],
  opportunities: [{
    id: 1,
    titulo: 'Olimpíada Brasileira de Matemática (OBMEP)',
    org: 'IMPA · MEC',
    tipo: 'Olimpíadas Científicas',
    status: 'Publicada',
    inscricoesAbertas: true,
    nivel: ['Fundamental', 'Ensino Médio'],
    publico: ['Escola Pública', 'Baixa Renda'],
    custo: 'Gratuito',
    interesse: ['STEM'],
    areaAtuacao: 'Matemática',
    formato: 'Híbrido',
    local: 'Nacional',
    prazo: '30 jun 2026',
    dataInicio: 'Provas a partir de set 2026',
    inscritos: 1240,
    destaque: true,
    descricao: 'A maior olimpíada científica do país, voltada a estudantes de escolas públicas e privadas. A OBMEP estimula o estudo da matemática e revela talentos, abrindo portas para bolsas, programas de iniciação científica e ingresso em universidades.',
    elegibilidade: ['Estudantes matriculados do 6º ano do Ensino Fundamental à 3ª série do Ensino Médio.', 'Escolas públicas e privadas inscritas pelo diretor(a) ou responsável.', 'Não há custo de inscrição para o estudante.'],
    processo: 'A competição tem duas fases. A 1ª fase é objetiva e aplicada na própria escola. Os melhores avançam para a 2ª fase, com questões discursivas. A premiação inclui medalhas de ouro, prata e bronze, além de menções honrosas.',
    dicas: ['Resolva provas de edições anteriores — o estilo das questões se repete muito.', 'Foque em raciocínio lógico, não só em fórmulas decoradas.', 'Participe do PIC (Programa de Iniciação Científica) se for medalhista.'],
    infoAdicional: 'Medalhistas podem ser convidados para o PIC-OBMEP, com bolsa do CNPq. O desempenho é valorizado em processos seletivos e no currículo acadêmico.',
    recursos: [{
      plataforma: 'youtube',
      titulo: 'Como se preparar para a OBMEP — fase 1',
      meta: 'Canal Matemática Rio · 142k views'
    }, {
      plataforma: 'reddit',
      titulo: 'Dúvidas sobre a 2ª fase da OBMEP 2025',
      meta: 'r/estudantesBR · 318 votos'
    }, {
      plataforma: 'instagram',
      titulo: '@obmep_oficial — gabarito comentado',
      meta: '12,4k curtidas'
    }],
    tagsRelacionadas: ['Matemática', 'Iniciação científica', 'Bolsa CNPq', 'Escola pública'],
    comentarios: [{
      id: 'c1a',
      autor: 'Júlia M.',
      iniciais: 'JM',
      cor: 'var(--azul)',
      quando: 'há 3 h',
      texto: 'Fiz a primeira fase ano passado e o nível foi bem tranquilo. Recomendo treinar com as provas antigas mesmo!'
    }, {
      id: 'c1b',
      autor: 'Ana Clara',
      iniciais: 'AC',
      cor: 'var(--grifa-topicos)',
      quando: 'há 1 dia',
      texto: 'Alguém sabe se a escola precisa inscrever ou dá pra fazer individual? Minha coordenação não respondeu ainda.'
    }, {
      id: 'c1c',
      autor: 'usuario_4471',
      iniciais: '??',
      cor: 'var(--neutral-500)',
      quando: 'há 2 dias',
      texto: 'COMPRE SEGUIDORES E GABARITOS BARATO no link da minha bio 🔥🔥 promoção só hoje',
      sinalizado: true
    }, {
      id: 'c1d',
      autor: 'Pedro H.',
      iniciais: 'PH',
      cor: 'var(--success)',
      quando: 'há 4 dias',
      texto: 'O PIC depois da OBMEP muda tudo, consegui bolsa do CNPq por causa disso. Vale muito a pena.'
    }]
  }, {
    id: 2,
    titulo: 'Harvard Model United Nations (HMUN)',
    org: 'Harvard University',
    tipo: 'MUNs',
    status: 'Publicada',
    inscricoesAbertas: true,
    nivel: ['Ensino Médio'],
    publico: ['Baixa Renda', 'Escola Pública'],
    custo: 'Bolsa',
    interesse: ['Humanas', 'Linguagens'],
    areaAtuacao: 'Relações Internacionais',
    formato: 'Presencial',
    local: 'Boston, EUA',
    prazo: '12 jul 2026',
    dataInicio: 'Conferência jan 2027',
    inscritos: 86,
    destaque: true,
    descricao: 'Simulação das Nações Unidas reunindo estudantes do mundo todo para debater questões globais. Desenvolve oratória, negociação e inglês — com bolsas de delegação para estudantes de baixa renda.',
    elegibilidade: ['Estudantes do Ensino Médio (15 a 18 anos).', 'Inglês intermediário/avançado (carta de motivação em inglês).', 'Bolsas disponíveis mediante análise socioeconômica.'],
    processo: 'Seleção por carta de motivação e entrevista. Delegações aprovadas recebem treinamento prévio. A bolsa cobre inscrição, passagem e hospedagem para contemplados.',
    dicas: ['Capriche na carta de motivação — mostre repertório sobre temas globais.', 'Pratique inglês falado; o debate é ao vivo.', 'Estude as regras de procedimento (Rules of Procedure) antes.'],
    infoAdicional: 'Participar de um MUN internacional é um diferencial forte em aplicações para universidades no exterior.',
    recursos: [{
      plataforma: 'youtube',
      titulo: 'O que é um MUN? Guia para iniciantes',
      meta: 'Canal MUN Brasil · 58k views'
    }, {
      plataforma: 'reddit',
      titulo: 'Vale a pena pagar para ir a um MUN no exterior?',
      meta: 'r/intercambio · 204 votos'
    }, {
      plataforma: 'instagram',
      titulo: '@hmun — bastidores da conferência',
      meta: '8,9k curtidas'
    }],
    tagsRelacionadas: ['Inglês', 'Oratória', 'Intercâmbio', 'Relações internacionais'],
    comentarios: [{
      id: 'c2a',
      autor: 'Letícia R.',
      iniciais: 'LR',
      cor: 'var(--vermelha)',
      quando: 'há 5 h',
      texto: 'A bolsa cobre mesmo passagem e hospedagem? Queria entender melhor a análise socioeconômica antes de aplicar.'
    }, {
      id: 'c2b',
      autor: 'Marcos V.',
      iniciais: 'MV',
      cor: 'var(--azul)',
      quando: 'há 2 dias',
      texto: 'Participei do MUN regional e ajudou demais no meu inglês falado. Carta de motivação é o ponto chave!'
    }]
  }, {
    id: 3,
    titulo: 'Programa de Bolsas Santander Universidades',
    org: 'Santander',
    tipo: 'Bolsas de Estudo',
    status: 'Publicada',
    inscricoesAbertas: true,
    nivel: ['Gap'],
    publico: ['Baixa Renda', 'Negros'],
    custo: 'Totalmente Financiado',
    interesse: ['STEM', 'Humanas'],
    areaAtuacao: 'Ensino Superior',
    formato: 'Online',
    local: 'Nacional',
    prazo: '05 jul 2026',
    dataInicio: 'Resultados ago 2026',
    inscritos: 510,
    destaque: false,
    descricao: 'Bolsas de estudo e auxílio para estudantes universitários de baixa renda, com trilhas de capacitação, mentoria e acesso a uma rede internacional de oportunidades.',
    elegibilidade: ['Matriculado(a) em curso de graduação reconhecido.', 'Renda familiar de até 1,5 salário mínimo per capita.', 'Bom histórico acadêmico.'],
    processo: 'Inscrição online + envio de documentação socioeconômica. Etapa de análise e, para alguns programas, prova de inglês ou entrevista.',
    dicas: ['Reúna a documentação de renda com antecedência.', 'Tenha um e-mail e CPF ativos — a comunicação é toda digital.'],
    infoAdicional: 'Algumas bolsas dão acesso ao Santander Open Academy, com cursos gratuitos certificados.',
    recursos: [{
      plataforma: 'youtube',
      titulo: 'Como se inscrever nas bolsas Santander',
      meta: 'Canal Bolsas & Editais · 31k views'
    }, {
      plataforma: 'instagram',
      titulo: '@santanderbolsas — passo a passo',
      meta: '5,1k curtidas'
    }],
    tagsRelacionadas: ['Bolsa', 'Universidade', 'Mentoria', 'Inglês'],
    comentarios: [{
      id: 'c3a',
      autor: 'Gabriel S.',
      iniciais: 'GS',
      cor: 'var(--grifa-topicos)',
      quando: 'há 8 h',
      texto: 'Documentação de renda é o que mais trava a galera. Separem tudo com antecedência mesmo.'
    }, {
      id: 'c3b',
      autor: 'anon_998',
      iniciais: '??',
      cor: 'var(--neutral-500)',
      quando: 'há 1 dia',
      texto: 'isso aí é furada, ninguém ganha nada, parem de perder tempo 🙄',
      sinalizado: true
    }]
  }, {
    id: 4,
    titulo: 'Programa Jovem Embaixador (Intercâmbio EUA)',
    org: 'Embaixada dos EUA',
    tipo: 'Programas de Intercâmbio',
    status: 'Em revisão',
    inscricoesAbertas: false,
    nivel: ['Ensino Médio'],
    publico: ['Escola Pública', 'Baixa Renda'],
    custo: 'Totalmente Financiado',
    interesse: ['Linguagens', 'Humanas'],
    areaAtuacao: 'Liderança Jovem',
    formato: 'Presencial',
    local: 'Estados Unidos',
    prazo: '20 jul 2026',
    dataInicio: 'Viagem jan 2027',
    inscritos: 0,
    destaque: false,
    descricao: 'Intercâmbio totalmente financiado nos EUA para estudantes de escola pública com bom desempenho, engajamento social e fluência em inglês.',
    elegibilidade: ['Aluno(a) de escola pública, 1ª ou 2ª série do Ensino Médio.', 'Inglês avançado.', 'Histórico de trabalho voluntário/comunitário.'],
    processo: 'Inscrição estadual → seleção nacional → entrevista. Programa custeia passagem, hospedagem e atividades.',
    dicas: ['Documente seu trabalho voluntário com fotos e cartas.', 'Treine entrevista em inglês com temas de cidadania.'],
    infoAdicional: 'Ex-participantes integram uma rede de alumni com acesso a novas oportunidades.',
    recursos: [{
      plataforma: 'youtube',
      titulo: 'Depoimento: minha experiência como Jovem Embaixador',
      meta: 'Canal Intercâmbio Real · 22k views'
    }, {
      plataforma: 'reddit',
      titulo: 'Como foi a seleção do Jovem Embaixador?',
      meta: 'r/intercambio · 156 votos'
    }],
    tagsRelacionadas: ['Intercâmbio', 'Inglês', 'Liderança', 'Escola pública']
  }, {
    id: 5,
    titulo: 'Olimpíada de Língua Portuguesa — Escrevendo o Futuro',
    org: 'Fundação Itaú',
    tipo: 'Competições de Escrita',
    status: 'Rascunho',
    inscricoesAbertas: false,
    nivel: ['Fundamental', 'Ensino Médio'],
    publico: ['Escola Pública'],
    custo: 'Gratuito',
    interesse: ['Linguagens', 'Artes'],
    areaAtuacao: 'Língua Portuguesa',
    formato: 'Presencial',
    local: 'Nacional',
    prazo: '—',
    dataInicio: 'A definir',
    inscritos: 0,
    destaque: false,
    descricao: 'Competição de escrita para estudantes de escolas públicas, com gêneros como poema, memórias, crônica e artigo de opinião.',
    elegibilidade: ['Estudantes de escolas públicas do 5º ano ao 3º ano do EM.', 'Inscrição feita pelo professor(a) orientador(a).'],
    processo: 'Produção textual orientada em sala → seleção escolar, municipal, estadual e nacional.',
    dicas: ['Leia textos premiados de edições anteriores.', 'Revise com seu professor antes de enviar.'],
    infoAdicional: 'Finalistas participam de um encontro nacional de formação.',
    recursos: [{
      plataforma: 'instagram',
      titulo: '@escrevendoofuturo — temas da edição',
      meta: '3,3k curtidas'
    }],
    tagsRelacionadas: ['Escrita', 'Redação', 'Língua portuguesa', 'Escola pública']
  }, {
    id: 6,
    titulo: 'Technovation Girls — Tecnologia para meninas',
    org: 'Technovation',
    tipo: 'Competições',
    status: 'Publicada',
    inscricoesAbertas: true,
    nivel: ['Fundamental', 'Ensino Médio'],
    publico: ['Meninas', 'Baixa Renda'],
    custo: 'Gratuito',
    interesse: ['STEM', 'Meio Ambiente'],
    areaAtuacao: 'Tecnologia e Empreendedorismo',
    formato: 'Online',
    local: 'Global',
    prazo: '15 ago 2026',
    dataInicio: 'Temporada mar–ago',
    inscritos: 276,
    destaque: false,
    descricao: 'Programa global que desafia meninas a criar um aplicativo para resolver um problema da sua comunidade, com apoio de mentoras voluntárias.',
    elegibilidade: ['Meninas de 8 a 18 anos.', 'Trabalho em equipes de 1 a 5 integrantes.', 'Gratuito, com material e mentoria inclusos.'],
    processo: 'Formação de equipe → desenvolvimento do app e plano de negócios → submissão → avaliação regional e mundial.',
    dicas: ['Escolha um problema real da sua comunidade.', 'Aproveite as mentoras — elas ajudam muito no pitch.'],
    infoAdicional: 'Finalistas concorrem a bolsas e participam de uma cerimônia mundial.',
    recursos: [{
      plataforma: 'youtube',
      titulo: 'Technovation: como montar seu app do zero',
      meta: 'Canal Meninas STEM · 19k views'
    }, {
      plataforma: 'instagram',
      titulo: '@technovationgirls — projetos vencedores',
      meta: '7,6k curtidas'
    }, {
      plataforma: 'reddit',
      titulo: 'Dicas de pitch para a Technovation',
      meta: 'r/programacao · 92 votos'
    }],
    tagsRelacionadas: ['Tecnologia', 'Meninas na STEM', 'Empreendedorismo', 'App'],
    comentarios: [{
      id: 'c6a',
      autor: 'Sophia L.',
      iniciais: 'SL',
      cor: 'var(--azul)',
      quando: 'há 6 h',
      texto: 'As mentoras são incríveis, montei meu primeiro app com a ajuda delas. Não tenham medo de começar do zero!'
    }, {
      id: 'c6b',
      autor: 'Beatriz N.',
      iniciais: 'BN',
      cor: 'var(--success)',
      quando: 'há 3 dias',
      texto: 'Dá pra participar morando no interior? É tudo online mesmo?'
    }]
  }],
  team: [{
    id: 1,
    nome: 'Camila Rocha',
    iniciais: 'CR',
    cargo: 'Curadoria de oportunidades',
    papel: 'Admin',
    email: 'camila@accessplus.com.br',
    status: 'Ativo',
    cor: 'var(--grifa-topicos)'
  }, {
    id: 2,
    nome: 'Diego Fernandes',
    iniciais: 'DF',
    cargo: 'Conteúdo e parcerias',
    papel: 'Editor',
    email: 'diego@accessplus.com.br',
    status: 'Ativo',
    cor: 'var(--azul)'
  }, {
    id: 3,
    nome: 'Beatriz Antunes',
    iniciais: 'BA',
    cargo: 'Curadoria de oportunidades',
    papel: 'Editor',
    email: 'beatriz@accessplus.com.br',
    status: 'Ativo',
    cor: 'var(--vermelha)'
  }, {
    id: 4,
    nome: 'Rafael Moreira',
    iniciais: 'RM',
    cargo: 'Dados e relacionamento',
    papel: 'Analista',
    email: 'rafael@accessplus.com.br',
    status: 'Convite pendente',
    cor: 'var(--ink)'
  }, {
    id: 5,
    nome: 'Letícia Carvalho',
    iniciais: 'LC',
    cargo: 'Comunicação e redes',
    papel: 'Editor',
    email: 'leticia@accessplus.com.br',
    status: 'Ativo',
    cor: 'var(--success)'
  }, {
    id: 6,
    nome: 'Pedro Henrique Dias',
    iniciais: 'PD',
    cargo: 'Curadoria — STEM',
    papel: 'Viewer',
    email: 'pedro@accessplus.com.br',
    status: 'Inativo',
    cor: 'var(--warning)'
  }],
  activity: [{
    icon: 'circle-check',
    color: 'var(--success)',
    text: '<b>OBMEP</b> foi publicada por Camila',
    time: 'há 2 h'
  }, {
    icon: 'pencil',
    color: 'var(--grifa-topicos)',
    text: '<b>Jovem Embaixador</b> enviado para revisão',
    time: 'há 6 h'
  }, {
    icon: 'user-plus',
    color: 'var(--azul)',
    text: 'Rafael foi convidado para o time',
    time: 'há 1 dia'
  }, {
    icon: 'clock',
    color: 'var(--warning)',
    text: '<b>Bolsas Santander</b> encerra em 3 dias',
    time: 'há 1 dia'
  }],
  statusVariant: {
    'Publicada': 'success',
    'Em revisão': 'warning',
    'Rascunho': 'neutral',
    'Encerrada': 'danger',
    'Ativo': 'success',
    'Convite pendente': 'warning',
    'Inativo': 'neutral'
  },
  papelVariant: {
    'Admin': 'primary',
    'Editor': 'mint',
    'Analista': 'pink',
    'Viewer': 'neutral'
  },
  tipoVariant: {
    'Olimpíadas Científicas': 'primary',
    'MUNs': 'pink',
    'Programas Acadêmicos': 'mint',
    'Programas de Intercâmbio': 'primary',
    'Bolsas de Estudo': 'lime',
    'Competições': 'pink',
    'Competições de Escrita': 'mint',
    'Mentorias': 'lime'
  },
  custoVariant: {
    'Gratuito': 'success',
    'Bolsa': 'primary',
    'Totalmente Financiado': 'mint'
  },
  // ---- Newsletter: connected Instagram source accounts ----
  instaAccounts: [{
    id: 1,
    handle: '@obmep_oficial',
    nome: 'OBMEP',
    seguidores: '142k',
    cor: 'var(--azul)',
    incluido: true
  }, {
    id: 2,
    handle: '@santanderbolsas',
    nome: 'Santander Bolsas',
    seguidores: '88k',
    cor: 'var(--vermelha)',
    incluido: true
  }, {
    id: 3,
    handle: '@technovationgirls',
    nome: 'Technovation Girls',
    seguidores: '61k',
    cor: 'var(--grifa-topicos)',
    incluido: true
  }, {
    id: 4,
    handle: '@hmun',
    nome: 'Harvard MUN',
    seguidores: '54k',
    cor: 'var(--ink)',
    incluido: false
  }, {
    id: 5,
    handle: '@escrevendoofuturo',
    nome: 'Escrevendo o Futuro',
    seguidores: '33k',
    cor: 'var(--success)',
    incluido: false
  }, {
    id: 6,
    handle: '@intercambio.gov',
    nome: 'Intercâmbio Brasil',
    seguidores: '120k',
    cor: 'var(--warning)',
    incluido: true
  }],
  // ---- Recent Instagram posts pulled from the accounts above ----
  instaPosts: [{
    id: 1,
    conta: '@obmep_oficial',
    tipo: 'Carrossel',
    resumo: 'Inscrições da OBMEP 2026 estão abertas! Veja como participar.',
    curtidas: '3.2k',
    quando: 'há 2 h',
    oportunidade: 'Olimpíada Brasileira de Matemática (OBMEP)'
  }, {
    id: 2,
    conta: '@santanderbolsas',
    tipo: 'Reel',
    resumo: 'Passo a passo para se inscrever nas bolsas Santander.',
    curtidas: '5.1k',
    quando: 'há 5 h',
    oportunidade: 'Programa de Bolsas Santander Universidades'
  }, {
    id: 3,
    conta: '@technovationgirls',
    tipo: 'Post',
    resumo: 'Meninas, montem sua equipe e criem um app que muda a sua comunidade.',
    curtidas: '7.6k',
    quando: 'há 1 dia',
    oportunidade: 'Technovation Girls — Tecnologia para meninas'
  }, {
    id: 4,
    conta: '@intercambio.gov',
    tipo: 'Carrossel',
    resumo: 'Programa Jovem Embaixador: intercâmbio totalmente financiado nos EUA.',
    curtidas: '9.4k',
    quando: 'há 1 dia',
    oportunidade: 'Programa Jovem Embaixador (Intercâmbio EUA)'
  }, {
    id: 5,
    conta: '@obmep_oficial',
    tipo: 'Reel',
    resumo: 'Dica de prova: como resolver questões de lógica em 2 minutos.',
    curtidas: '2.8k',
    quando: 'há 2 dias',
    oportunidade: 'Olimpíada Brasileira de Matemática (OBMEP)'
  }, {
    id: 6,
    conta: '@santanderbolsas',
    tipo: 'Post',
    resumo: 'Documentos que você precisa separar para a análise socioeconômica.',
    curtidas: '1.9k',
    quando: 'há 3 dias',
    oportunidade: 'Programa de Bolsas Santander Universidades'
  }],
  // ---- Past newsletter editions ----
  newsletters: [{
    id: 1,
    titulo: 'Oportunidades da semana · 09 jun',
    status: 'Enviada',
    data: '09 jun 2026',
    destinatarios: '9.412',
    aberturas: '62%',
    itens: 5
  }, {
    id: 2,
    titulo: 'Especial Bolsas & Intercâmbios',
    status: 'Enviada',
    data: '02 jun 2026',
    destinatarios: '9.218',
    aberturas: '58%',
    itens: 6
  }, {
    id: 3,
    titulo: 'Edição STEM para meninas',
    status: 'Agendada',
    data: '16 jun 2026',
    destinatarios: '9.412',
    aberturas: '—',
    itens: 4
  }, {
    id: 4,
    titulo: 'Oportunidades da semana · 16 jun',
    status: 'Rascunho',
    data: '—',
    destinatarios: '—',
    aberturas: '—',
    itens: 3
  }],
  newsletterStatusVariant: {
    'Enviada': 'success',
    'Agendada': 'primary',
    'Rascunho': 'neutral'
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/data.js", error: String((e && e.message) || e) }); }

// ui_kits/admin/icons.js
try { (() => {
// Inline-SVG Lucide renderer — returns real React <svg> elements so icons
// survive React re-renders (no DOM replacement) and screenshot cleanly.
(function () {
  const SIZES = {
    'ico': 19,
    'ico-sm': 16,
    'ico-xs': 14,
    'ico-star': 15,
    'nav-ico': 19,
    'nav-ico-sm': 15
  };
  function pascal(n) {
    return n.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }
  function sizeFor(cls) {
    if (cls) {
      const parts = cls.split(' ');
      for (const k in SIZES) {
        if (parts.indexOf(k) !== -1) return SIZES[k];
      }
    }
    return 18;
  }
  window.Ic = function (name, cls) {
    const L = window.lucide;
    const node = L && L[pascal(name)];
    if (!node || !node[2]) return null;
    const size = sizeFor(cls);
    const children = node[2].map((c, i) => React.createElement(c[0], Object.assign({
      key: i
    }, c[1])));
    return React.createElement('svg', {
      className: cls,
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true
    }, children);
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/icons.js", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardBody = __ds_scope.CardBody;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
