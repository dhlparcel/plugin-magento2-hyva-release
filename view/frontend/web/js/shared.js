const refreshRates = () => {
    let component
    let isRefreshed
    if (window.Magewire && typeof window.Magewire.find === 'function') {
        // Refresh the delivery methods component so that the selected service point info is updated
        component = window.Magewire.find('checkout.shipping.methods');
        if (component && typeof component.refresh === 'function') {
            component.refresh();
            isRefreshed = true
        }
        // Refresh the sub totals component so that the selected service point info is updated
        component = window.Magewire.find('price-summary.total-segments');
        if (component && typeof component.refresh === 'function') {
            component.refresh();
            isRefreshed = true
        }
    }
    // Fallback if Magewire component not found
    if (!isRefreshed) {
        window.location.reload();
    }
};

// Refresh delivery services and delivery times components when they need updating
const refreshDeliveryComponents = () => {
    if (!window.Magewire) {
        return;
    }

    // Find components via their DOM elements
    const deliveryServicesEl = document.querySelector('[data-dhl-deliveryservices][wire\\:id]');
    const deliveryTimesEl = document.querySelector('[data-dhl-deliverytimes][wire\\:id]');

    // Refresh delivery services component
    if (deliveryServicesEl) {
        const wireId = deliveryServicesEl.getAttribute('wire:id');
        if (wireId && window.Magewire.find) {
            const component = window.Magewire.find(wireId);
            if (component && typeof component.refresh === 'function') {
                component.refresh();
            }
        }
    }

    // Refresh delivery times component
    if (deliveryTimesEl) {
        const wireId = deliveryTimesEl.getAttribute('wire:id');
        if (wireId && window.Magewire.find) {
            const component = window.Magewire.find(wireId);
            if (component && typeof component.refresh === 'function') {
                component.refresh();
            }
        }
    }
};

window.addEventListener('dhlparcel:deliveryservices-updated', () => {
    refreshRates();
});

// Refresh delivery components when shipping method is activated
// This ensures components update when user navigates back from payment
window.addEventListener('checkout:shipping:method-activate', (event) => {
    if (!event || !event.detail || !event.detail.method) {
        return;
    }

    // Give Magewire a moment to process the method change, then refresh our components
    setTimeout(() => {
        refreshDeliveryComponents();
    }, 100);
});

// Refresh delivery components when shipping address changes
// This is needed because the Magewire components need to update when the address changes
(() => {
    let debounceId = null;
    const addressFields = ['shipping-postcode', 'shipping-country_id'];

    const handleAddressChange = () => {
        clearTimeout(debounceId);
        debounceId = setTimeout(() => {
            refreshDeliveryComponents();
        }, 500);
    };

    // Use event delegation on document to handle dynamically added fields
    document.addEventListener('change', (event) => {
        if (addressFields.some(field => event.target.matches(`[id="${field}"]`))) {
            handleAddressChange();
        }
    });

    document.addEventListener('input', (event) => {
        if (addressFields.some(field => event.target.matches(`[id="${field}"]`))) {
            handleAddressChange();
        }
    });
})();

// Postcode validation error message display
// Hyvä marks the field as invalid but does not show the specific error message
(() => {
    const ERROR_ELEMENT_ID = 'dhlparcel-shipping-postcode-error';

    const showPostcodeError = (postcodeField) => {
        let errorEl = document.getElementById(ERROR_ELEMENT_ID);
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = ERROR_ELEMENT_ID;
            errorEl.className = 'text-red-600 text-sm mt-1';
            const parent = postcodeField.closest('.field') || postcodeField.parentElement;
            if (parent) {
                parent.appendChild(errorEl);
            }
        }
        errorEl.textContent = postcodeField.validationMessage || 'Please enter a valid postcode.';
        errorEl.style.display = '';
    };

    const hidePostcodeError = () => {
        const errorEl = document.getElementById(ERROR_ELEMENT_ID);
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    };

    // Show error when HTML5 validation fails
    document.addEventListener('invalid', (event) => {
        if (event.target.matches('[id="shipping-postcode"]')) {
            showPostcodeError(event.target);
        }
    }, true);

    // Hide error when user corrects the input
    document.addEventListener('input', (event) => {
        if (event.target.matches('[id="shipping-postcode"]')) {
            if (event.target.checkValidity()) {
                hidePostcodeError();
            }
        }
    });
})();

// Fix for message undefined error when navigating back from payment to checkout
let message = {
    id: ''
}
