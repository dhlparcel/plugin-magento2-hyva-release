(() => {
    const baseUrl = window.BASE_URL || '/';

    const translate = (key) => {
        if (window.I18n && typeof window.I18n.translate === 'function') {
            const result = window.I18n.translate(key);
            if (result && typeof result.toString === 'function') {
                return result.toString();
            }
        }
        return key;
    };

    const getShippingMethod = () => {
        return window.dhlparcelShippingCurrentMethod || null;
    };


    const showErrorById = (id) => {
        const el = id ? document.getElementById(id) : null;
        if (el) {
            el.style.display = '';
        }
    };

    const validateServicepoint = async () => {
        if (window.dhlparcelServicepointValid === true) {
            return true;
        }

        const response = await fetch(`${baseUrl}dhlparcel_shipping/servicepoint/validate`, {
            credentials: 'same-origin'
        });
        const payload = await response.json();
        if (payload && payload.data === true) {
            window.dhlparcelServicepointValid = true;
            return true;
        }
        showErrorById('dhlparcel-shipping-servicepoint-info-error');
        throw new Error(translate('Please choose a DHL ServicePoint.'));
    };

    const validateDeliveryTimes = () => {
        const container = document.querySelector('[data-dhl-deliverytimes]');
        if (!container || container.hasAttribute('hidden')) {
            return Promise.resolve(true);
        }

        const select = container.querySelector('#dhlparcel-delivery-times');
        if (!select) {
            return Promise.resolve(true);
        }

        // When there are no options (e.g. API returns nothing), do not block checkout.
        if (!select.options || select.options.length === 0) {
            return Promise.resolve(true);
        }

        if (select.value && select.value.toString().trim() !== '') {
            return Promise.resolve(true);
        }

        showErrorById('dhlparcel-shipping-deliverytimes-info-error');
        return Promise.reject(new Error(translate('Please choose the moment of delivery')));
    };

    const getDeliveryServicesState = () => {
        const container = document.querySelector('[data-dhl-deliveryservices]');
        if (!container) {
            return {
                enabled: window.dhlparcelShippingDeliveryServicesEnabled === true,
                validated: window.dhlparcelDeliveryServicesValidated === true,
                hidden: true
            };
        }

        return {
            enabled: container.dataset.enabled === 'true',
            validated: container.dataset.validated === 'true',
            hidden: container.hasAttribute('hidden')
        };
    };

    const validateDeliveryServices = () => {
        const method = getShippingMethod();
        const { enabled, validated, hidden } = getDeliveryServicesState();
        if (hidden || method !== 'dhlparcel_door' || !enabled) {
            return Promise.resolve(true);
        }

        if (validated) {
            return Promise.resolve(true);
        }

        showErrorById('dhlparcel-shipping-deliveryservices-info-error');
        return Promise.reject(new Error(translate('Please select at least one delivery service.')));
    };

    window.addEventListener('checkout:place-order', (event) => {
        if (!event || !event.detail) {
            return;
        }
        const { resolve, reject } = event.detail;

        const checks = [];
        const method = getShippingMethod();
        if (method === 'dhlparcel_servicepoint') {
            checks.push(validateServicepoint());
        }
        checks.push(validateDeliveryTimes());
        checks.push(validateDeliveryServices());

        Promise.all(checks)
            .then(() => typeof resolve === 'function' && resolve())
            .catch((error) => {
                if (typeof reject === 'function') {
                    reject(error instanceof Error ? error.message : translate('Please check your DHL selections.'));
                }
            });
    });

    // Keep method in sync for validators that only know about the Hyvä event.
    window.addEventListener('checkout:shipping:method-activate', (event) => {
        if (event && event.detail && event.detail.method) {
            window.dhlparcelShippingCurrentMethod = event.detail.method;
        }
    });
})();
