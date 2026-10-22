import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownSelectProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label?: string;
  /** Visually hide the label but keep it for screen readers */
  labelHidden?: boolean;
  className?: string;
  selectClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Extra content rendered inside the closed trigger (e.g. swatch) */
  leading?: ReactNode;
  id?: string;
  "aria-label"?: string;
  /** Merge search + dropdown into one combobox field */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /**
   * When set, the closed trigger always shows this text (e.g. “Sort”, “Filter”)
   * instead of the selected option label. Options still work in the menu.
   * Ignored when `searchable` (combobox shows query / selection in the input).
   */
  triggerLabel?: string;
  /**
   * Searchable only: keep the search placeholder in the closed field
   * instead of filling it with the selected option label.
   */
  keepSearchPlaceholder?: boolean;
  /**
   * Searchable only: allow committing typed text that isn’t in the list
   * (Enter or blur / click outside).
   */
  allowCustom?: boolean;
}

/**
 * Custom select that always opens the menu under the trigger box
 * (native OS selects often overlay the field itself).
 * When `searchable`, search and dropdown are one merged combobox.
 */
export function DropdownSelect({
  value,
  options,
  onChange,
  label,
  labelHidden = false,
  className = "",
  selectClassName = "",
  disabled = false,
  placeholder = "Select…",
  leading,
  id,
  "aria-label": ariaLabel,
  searchable = false,
  searchPlaceholder = "Type a name…",
  emptyMessage = "No matches",
  triggerLabel,
  keepSearchPlaceholder = false,
  allowCustom = false,
}: DropdownSelectProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listId = `${triggerId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);
  const closedLabel = selected?.label ?? (value || "");
  const display = triggerLabel ?? selected?.label ?? (value || placeholder);

  const filtered = useMemo(() => {
    if (!searchable) return options;
    const needle = (open ? filter : query).trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, searchable, open, filter, query]);

  useEffect(() => {
    if (!searchable) return;
    if (!open) {
      setQuery(keepSearchPlaceholder ? "" : closedLabel);
      setFilter("");
    }
  }, [searchable, open, closedLabel, value, keepSearchPlaceholder]);

  useEffect(() => {
    if (!open) return;
    if (searchable) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, searchable]);

  function resolveTyped(raw: string, preferFirstMatch: boolean): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const exact = options.find(
      (option) => option.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exact) return exact.value;
    if (preferFirstMatch && filtered.length > 0) return filtered[0].value;
    if (allowCustom) return trimmed;
    if (filtered.length > 0) return filtered[0].value;
    return null;
  }

  function commitTypedIfNeeded() {
    if (!searchable || !allowCustom) return;
    const next = resolveTyped(filter, false);
    if (!next) return;
    if (next === value) {
      setQuery(keepSearchPlaceholder ? "" : closedLabel || next);
      setFilter("");
      return;
    }
    onChange(next);
    const labelText =
      options.find((option) => option.value === next)?.label ?? next;
    setQuery(keepSearchPlaceholder ? "" : labelText);
    setFilter("");
  }

  function pick(next: string) {
    onChange(next);
    const labelText =
      options.find((option) => option.value === next)?.label ?? next;
    setQuery(keepSearchPlaceholder ? "" : labelText);
    setFilter("");
    setOpen(false);
  }

  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function openMenu(seed = "") {
    setFilter(seed);
    setOpen(true);
  }

  if (searchable) {
    const inputValue = open
      ? filter
      : keepSearchPlaceholder
        ? ""
        : query || closedLabel;
    const showQuiet = !closedLabel && !inputValue;
    return (
      <div
        className={["dropdown-select dropdown-combobox", className]
          .filter(Boolean)
          .join(" ")}
        ref={rootRef}
      >
        {label ? (
          <span
            className={labelHidden ? "sr-only" : "field-label"}
            id={`${triggerId}-label`}
          >
            {label}
          </span>
        ) : null}
        <div
          className={[
            "dropdown-combo-field",
            selectClassName,
            showQuiet ? "dropdown-trigger-quiet" : "",
            open ? "open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {leading}
          <input
            ref={inputRef}
            id={triggerId}
            type="text"
            className="dropdown-combo-input"
            inputMode="search"
            value={inputValue}
            placeholder={searchPlaceholder || placeholder}
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-labelledby={label ? `${triggerId}-label` : undefined}
            aria-label={ariaLabel ?? searchPlaceholder ?? placeholder}
            onFocus={() => {
              // Empty field for typing/search; keep prior value until a new pick.
              openMenu("");
            }}
            onClick={() => {
              if (!open) openMenu("");
            }}
            onChange={(event) => {
              const next = event.target.value;
              setFilter(next);
              setQuery(next);
              if (!open) setOpen(true);
            }}
            onBlur={() => {
              // Defer so option clicks can pick first.
              window.setTimeout(() => {
                if (!rootRef.current?.contains(document.activeElement)) {
                  commitTypedIfNeeded();
                  setOpen(false);
                }
              }, 0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                openMenu(filter);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const next = resolveTyped(filter, true);
                if (next) pick(next);
              }
              if (event.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
          <button
            type="button"
            className="dropdown-combo-caret"
            tabIndex={-1}
            aria-label="Open list"
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
              if (open) {
                commitTypedIfNeeded();
                setOpen(false);
              } else openMenu("");
            }}
          >
            ▾
          </button>
        </div>
        {open ? (
          <div className="dropdown-panel">
            <ul
              id={listId}
              className="dropdown-menu"
              role="listbox"
              aria-labelledby={label ? `${triggerId}-label` : undefined}
            >
              {filtered.length === 0 ? (
                <li className="dropdown-empty" role="presentation">
                  {allowCustom && filter.trim()
                    ? `Press Enter to use “${filter.trim()}”`
                    : emptyMessage}
                </li>
              ) : (
                filtered.map((option) => (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      disabled={option.disabled}
                      className={
                        option.value === value
                          ? "dropdown-option selected"
                          : "dropdown-option"
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => pick(option.value)}
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={["dropdown-select", className].filter(Boolean).join(" ")}
      ref={rootRef}
    >
      {label ? (
        <span
          className={labelHidden ? "sr-only" : "field-label"}
          id={`${triggerId}-label`}
        >
          {label}
        </span>
      ) : null}
      <button
        type="button"
        id={triggerId}
        className={[
          "dropdown-trigger",
          selectClassName,
          triggerLabel || !selected ? "dropdown-trigger-quiet" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={label ? `${triggerId}-label` : undefined}
        aria-label={ariaLabel ?? (triggerLabel || undefined)}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKey}
      >
        {leading}
        <span className="dropdown-trigger-label">{display}</span>
        <span className="dropdown-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="dropdown-panel">
          <ul
            id={listId}
            className="dropdown-menu"
            role="listbox"
            aria-labelledby={label ? `${triggerId}-label` : undefined}
          >
            {filtered.length === 0 ? (
              <li className="dropdown-empty" role="presentation">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    className={
                      option.value === value
                        ? "dropdown-option selected"
                        : "dropdown-option"
                    }
                    onClick={() => pick(option.value)}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
