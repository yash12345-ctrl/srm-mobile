const fs = require('fs');
const path = require('path');

function patchFile(filePath, targetPattern, replacement) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-expo-router] Skipped: ${filePath} not found`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('safeSetLastUnhandledLink')) {
    console.log(`[patch-expo-router] Already patched: ${filePath}`);
    return;
  }

  if (!content.includes(targetPattern)) {
    console.warn(`[patch-expo-router] Target pattern not found in: ${filePath}`);
    return;
  }

  content = content.replace(targetPattern, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-expo-router] Successfully patched: ${filePath}`);
}

const rootDir = path.resolve(__dirname, '..');

// 1. Patch fork/NavigationContainer.js
const forkNav = path.join(rootDir, 'node_modules/expo-router/build/fork/NavigationContainer.js');
const forkTarget = `    const [lastUnhandledLink, setLastUnhandledLink] = react_1.default.useState();
    const { getInitialState } = (0, useLinking_1.useLinking)(refContainer, {
        enabled: isLinkingEnabled,
        prefixes: [],
        ...linking,
    }, setLastUnhandledLink);
    const linkingContext = react_1.default.useMemo(() => ({ options: linking }), [linking]);
    const unhandledLinkingContext = react_1.default.useMemo(() => ({ lastUnhandledLink, setLastUnhandledLink }), [lastUnhandledLink, setLastUnhandledLink]);
    const onReadyForLinkingHandling = (0, useLatestCallback_1.default)(() => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        setLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onReady?.();
    });
    const onStateChangeForLinkingHandling = (0, useLatestCallback_1.default)((state) => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        setLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onStateChange?.(state);
    });`;

const forkReplacement = `    const isMountedRef = react_1.default.useRef(false);
    const pendingUnhandledLinkRef = react_1.default.useRef(undefined);
    const [lastUnhandledLink, setLastUnhandledLink] = react_1.default.useState();
    react_1.default.useEffect(() => {
        isMountedRef.current = true;
        if (pendingUnhandledLinkRef.current !== undefined) {
            setLastUnhandledLink(pendingUnhandledLinkRef.current);
            pendingUnhandledLinkRef.current = undefined;
        }
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const safeSetLastUnhandledLink = react_1.default.useCallback((value) => {
        if (isMountedRef.current) {
            setLastUnhandledLink(value);
        } else {
            if (typeof value === 'function') {
                pendingUnhandledLinkRef.current = value(pendingUnhandledLinkRef.current);
            } else {
                pendingUnhandledLinkRef.current = value;
            }
        }
    }, [setLastUnhandledLink]);
    const { getInitialState } = (0, useLinking_1.useLinking)(refContainer, {
        enabled: isLinkingEnabled,
        prefixes: [],
        ...linking,
    }, safeSetLastUnhandledLink);
    const linkingContext = react_1.default.useMemo(() => ({ options: linking }), [linking]);
    const unhandledLinkingContext = react_1.default.useMemo(() => ({ lastUnhandledLink, setLastUnhandledLink: safeSetLastUnhandledLink }), [lastUnhandledLink, safeSetLastUnhandledLink]);
    const onReadyForLinkingHandling = (0, useLatestCallback_1.default)(() => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        safeSetLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onReady?.();
    });
    const onStateChangeForLinkingHandling = (0, useLatestCallback_1.default)((state) => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        safeSetLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onStateChange?.(state);
    });`;

patchFile(forkNav, forkTarget, forkReplacement);

// 2. Patch react-navigation/native/NavigationContainer.js
const nativeNav = path.join(rootDir, 'node_modules/expo-router/build/react-navigation/native/NavigationContainer.js');
const nativeTarget = `    const [lastUnhandledLink, setLastUnhandledLink] = React.useState();
    const { getInitialState } = (0, useLinking_1.useLinking)(refContainer, {
        enabled: isLinkingEnabled,
        prefixes: [],
        ...linking,
    }, setLastUnhandledLink);
    const linkingContext = React.useMemo(() => ({ options: linking }), [linking]);
    const unhandledLinkingContext = React.useMemo(() => ({ lastUnhandledLink, setLastUnhandledLink }), [lastUnhandledLink, setLastUnhandledLink]);
    const onReadyForLinkingHandling = (0, useLatestCallback_1.default)(() => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        setLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onReady?.();
    });
    const onStateChangeForLinkingHandling = (0, useLatestCallback_1.default)((state) => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        setLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onStateChange?.(state);
    });`;

const nativeReplacement = `    const isMountedRef = React.useRef(false);
    const pendingUnhandledLinkRef = React.useRef(undefined);
    const [lastUnhandledLink, setLastUnhandledLink] = React.useState();
    React.useEffect(() => {
        isMountedRef.current = true;
        if (pendingUnhandledLinkRef.current !== undefined) {
            setLastUnhandledLink(pendingUnhandledLinkRef.current);
            pendingUnhandledLinkRef.current = undefined;
        }
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const safeSetLastUnhandledLink = React.useCallback((value) => {
        if (isMountedRef.current) {
            setLastUnhandledLink(value);
        } else {
            if (typeof value === 'function') {
                pendingUnhandledLinkRef.current = value(pendingUnhandledLinkRef.current);
            } else {
                pendingUnhandledLinkRef.current = value;
            }
        }
    }, [setLastUnhandledLink]);
    const { getInitialState } = (0, useLinking_1.useLinking)(refContainer, {
        enabled: isLinkingEnabled,
        prefixes: [],
        ...linking,
    }, safeSetLastUnhandledLink);
    const linkingContext = React.useMemo(() => ({ options: linking }), [linking]);
    const unhandledLinkingContext = React.useMemo(() => ({ lastUnhandledLink, setLastUnhandledLink: safeSetLastUnhandledLink }), [lastUnhandledLink, safeSetLastUnhandledLink]);
    const onReadyForLinkingHandling = (0, useLatestCallback_1.default)(() => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        safeSetLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onReady?.();
    });
    const onStateChangeForLinkingHandling = (0, useLatestCallback_1.default)((state) => {
        // If the screen path matches lastUnhandledLink, we do not track it
        const path = refContainer.current?.getCurrentRoute()?.path;
        safeSetLastUnhandledLink((previousLastUnhandledLink) => {
            if (previousLastUnhandledLink === path) {
                return undefined;
            }
            return previousLastUnhandledLink;
        });
        onStateChange?.(state);
    });`;

patchFile(nativeNav, nativeTarget, nativeReplacement);
