(() => {
    // Use functions to get DOM elements dynamically to handle Magewire re-renders
    const getRoot = () => document.querySelector('[data-dhl-servicepoint]');
    const getOverlay = () => {
        const root = getRoot();
        return root ? root.querySelector('[data-role="servicepoint-overlay"]') : null;
    };
    const getModalMount = () => {
        const root = getRoot();
        return root ? root.querySelector('#dhlparcel-shipping-modal') : null;
    };

    const root = getRoot();
    if (!root) {
        return;
    }

    window.dhlparcelServicepointValid = false;

    const baseUrl = root.dataset.baseUrl || window.BASE_URL || '/';
    const formKey = root.dataset.formKey || (window.hyva && typeof window.hyva.getFormKey === 'function' ? window.hyva.getFormKey() : '');

    let modalLoaded = false;
    let locatorInstance = null;
    let locatorContainer = null;  // Store reference to detect DOM replacement
    let currentMethod = null;

    const showRoot = () => {
        const root = getRoot();
        if (root) {
            root.style.display = '';
        }
    };

    const hideRoot = () => {
        const root = getRoot();
        const overlay = getOverlay();
        if (root) {
            root.style.display = 'none';
        }
        if (overlay) {
            overlay.hidden = true;
        }
    };

    const ensureModalContent = async () => {
        const modalMount = getModalMount();

        if (!modalMount) {
            throw new Error('Modal mount element not found');
        }

        // Check if modal content is already loaded in the current DOM
        // Always check the actual DOM state, not just our flag, in case Magewire re-rendered
        if (modalMount.innerHTML.trim() !== '') {
            modalLoaded = true;
            return;
        }

        // Modal content needs to be loaded/re-loaded
        modalLoaded = false;

        const response = await fetch(`${baseUrl}dhlparcel_shipping/servicepoint/content`, {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('Failed to fetch ServicePoint modal content');
        }

        const payload = await response.json();
        if (!payload || !payload.data || !payload.data.view) {
            throw new Error('Unexpected ServicePoint modal response');
        }

        modalMount.innerHTML = payload.data.view;
        modalLoaded = true;
    };

    const syncSelection = async (servicepoint) => {
        const postcodeField = document.querySelector('[id="shipping-postcode"]');

        const data = new URLSearchParams({
            servicepoint_id: servicepoint.id || '',
            servicepoint_country: servicepoint.address ? servicepoint.address.countryCode : '',
            servicepoint_name: servicepoint.name || '',
            servicepoint_postcode: postcodeField && postcodeField.value ? postcodeField.value : '',
            form_key: formKey
        });

        await fetch(`${baseUrl}dhlparcel_shipping/servicepoint/sync`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: data.toString()
        });

        window.dhlparcelServicepointValid = true;
        refreshRates();

        const overlay = getOverlay();
        if (overlay) {
            overlay.hidden = true;
        }
    };

    const initLocator = () => {
        const modalContent = document.getElementById('dhl-servicepoint-locator-component');
        if (!modalContent) {
            throw new Error('ServicePoint locator container not found');
        }

        // Reset existing locator instance if the DOM element was replaced
        if (locatorInstance) {
            // Try to destroy the old instance if the API supports it
            if (typeof locatorInstance.destroy === 'function') {
                try {
                    locatorInstance.destroy();
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
            locatorInstance = null;
        }

        const options = {
            language: modalContent.dataset.locale || 'nl-NL',
            country: '',
            limit: modalContent.dataset.limit || 7,
            header: true,
            resizable: true,
            onSelect: syncSelection,
            filter: {
                serviceType: 'pick-up'
            }
        };

        if (modalContent.dataset.mapsKey && modalContent.dataset.mapsKey.length > 0) {
            options.googleMapsApiKey = modalContent.dataset.mapsKey;
        }

        locatorInstance = new window.dhl.servicepoint.Locator(modalContent, options);
        locatorContainer = modalContent;  // Store reference to detect DOM replacement
    };

    const applyAddressToLocator = () => {
        const countryField = document.querySelector('[id="shipping-country_id"]');
        const postcodeField = document.querySelector('[id="shipping-postcode"]');

        if (locatorInstance && typeof locatorInstance.setCountry === 'function' && countryField) {
            locatorInstance.setCountry(countryField.value || '');
        }
        if (locatorInstance && typeof locatorInstance.setQuery === 'function' && postcodeField) {
            locatorInstance.setQuery(postcodeField.value || '');
        }
    };

    const openSelector = async () => {
        try {
            // Reset modalLoaded if the container was replaced by Magewire
            if (locatorContainer && !document.contains(locatorContainer)) {
                modalLoaded = false;
                locatorInstance = null;
                locatorContainer = null;
            }

            await ensureModalContent();

            // Get the current modal content element
            const modalContent = document.getElementById('dhl-servicepoint-locator-component');

            // Re-initialize locator if:
            // 1. No locator instance exists, OR
            // 2. The DOM element doesn't have our initialization marker (was replaced by Magewire), OR
            // 3. The stored container element is no longer in the DOM
            const locatorContainerGone = locatorContainer && !document.contains(locatorContainer);
            const needsInit = !locatorInstance || locatorContainerGone || (modalContent && !modalContent._dhlLocatorInitialized);

            if (needsInit && modalContent) {
                initLocator();
                modalContent._dhlLocatorInitialized = true;
            }

            const overlay = getOverlay();
            if (overlay) {
                overlay.hidden = false;
            }

            // Apply address after showing to avoid zero-height init issues and trigger fetch
            applyAddressToLocator();
            requestAnimationFrame(() => {
                applyAddressToLocator();
                window.dispatchEvent(new Event('resize'));
            });
            setTimeout(() => {
                applyAddressToLocator();
                window.dispatchEvent(new Event('resize'));
            }, 50);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[DHL ServicePoint] Failed to open selector', error);
        }
    };

    const validateSelection = async () => {
        try {
            const response = await fetch(`${baseUrl}dhlparcel_shipping/servicepoint/validate`, {
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('Failed to validate ServicePoint selection');
            }
            const payload = await response.json();
            const isValid = payload && payload.data === true;
            if (!isValid) {
                window.dhlparcelServicepointValid = false;
                await openSelector();
                return;
            }
            window.dhlparcelServicepointValid = true;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[DHL ServicePoint] Validation failed', error);
        }
    };

    // Use event delegation on document to handle DOM re-renders from Magewire
    document.addEventListener('click', (event) => {
        // Handle open button click
        if (event.target.closest('[data-role="servicepoint-open"]')) {
            event.preventDefault();
            openSelector();
            return;
        }

        // Handle overlay click (close modal)
        const overlay = event.target.closest('[data-role="servicepoint-overlay"]');
        if (overlay && event.target === overlay) {
            overlay.hidden = true;
        }
    });

    hideRoot();

    window.addEventListener('checkout:shipping:method-activate', (event) => {
        if (!event || !event.detail || !event.detail.method) {
            return;
        }

        currentMethod = event.detail.method;
        window.dhlparcelShippingCurrentMethod = event.detail.method;

        if (event.detail.method === 'dhlparcel_servicepoint') {
            window.dhlparcelServicepointValid = false;

            // Reset state if the container was replaced by Magewire (e.g., after navigating back from payment)
            if (locatorContainer && !document.contains(locatorContainer)) {
                locatorInstance = null;
                locatorContainer = null;
                modalLoaded = false;
            }

            showRoot();
            validateSelection();
        } else {
            window.dhlparcelServicepointValid = false;
            hideRoot();
        }
    });

    // On address change, keep locator in sync (only when method is active)
    // Use event delegation on document to handle DOM re-renders
    const addressWatcher = () => {
        let debounceId = null;
        const handler = () => {
            clearTimeout(debounceId);
            debounceId = setTimeout(() => {
                if (currentMethod === 'dhlparcel_servicepoint') {
                    window.dhlparcelServicepointValid = false;
                }
                // Check if locator container was replaced by Magewire
                if (locatorContainer && !document.contains(locatorContainer)) {
                    locatorInstance = null;
                    locatorContainer = null;
                    modalLoaded = false;
                }
                if (currentMethod === 'dhlparcel_servicepoint' && locatorInstance) {
                    const countryField = document.querySelector('[id="shipping-country_id"]');
                    const postcodeField = document.querySelector('[id="shipping-postcode"]');
                    if (locatorInstance.setCountry && countryField) {
                        locatorInstance.setCountry(countryField.value || '');
                    }
                    if (locatorInstance.setQuery && postcodeField) {
                        locatorInstance.setQuery(postcodeField.value || '');
                    }
                }
            }, 300);
        };

        // Use event delegation on document to handle dynamically added fields
        document.addEventListener('change', (event) => {
            if (event.target.matches('[id="shipping-postcode"], [id="shipping-country_id"]')) {
                handler();
            }
        });
        document.addEventListener('input', (event) => {
            if (event.target.matches('[id="shipping-postcode"], [id="shipping-country_id"]')) {
                handler();
            }
        });
    };

    addressWatcher();
})();
