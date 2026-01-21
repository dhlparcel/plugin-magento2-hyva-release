<?php

namespace DHLParcel\ShippingHyva\Magewire\Checkout;

use DHLParcel\Shipping\Model\Service\Capability as CapabilityService;
use DHLParcel\Shipping\Model\Service\DeliveryServices as DeliveryServicesService;
use Magewirephp\Magewire\Component;
use Magento\Checkout\Model\Session as CheckoutSession;
use Magento\Store\Model\StoreManagerInterface;

class DeliveryServices extends Component
{
    // Events that should trigger a refresh of this component (they call hydrate implicitly)
    protected $listeners = [
        'shipping_method_selected' => 'handleEvent',
        'shipping_address_saved'   => 'handleEvent',
    ];

    private const METHOD_PROVIDING_SERVICES = 'dhlparcel_door';

    protected DeliveryServicesService $deliveryServices;
    protected CapabilityService $capabilityService;
    protected CheckoutSession $checkoutSession;
    protected StoreManagerInterface $storeManager;

    public bool $enabled = false;
    public bool $visible = false;
    public bool $validated = true;
    public ?string $shippingMethod = null;
    public ?string $postcode = null;
    public ?string $countryId = null;

    /**
     * @var array<int, array<string, mixed>>
     */
    public array $serviceData = [];

    /**
     * @var array<int, string>
     */
    public array $selectedServices = [];

    /**
     * @var array<string, array<int, string>>
     */
    public array $excludedServiceData = [];

    /**
     * @var array<int, string>
     */
    public array $excludedServices = [];

    public function __construct(
        DeliveryServicesService $deliveryServices,
        CapabilityService       $capabilityService,
        CheckoutSession         $checkoutSession,
        StoreManagerInterface   $storeManager,
    ) {
        $this->deliveryServices = $deliveryServices;
        $this->capabilityService = $capabilityService;
        $this->checkoutSession = $checkoutSession;
        $this->storeManager = $storeManager;
    }

    public function mount(): void
    {
        $this->syncFromQuote();
    }

    public function hydrate(): void
    {
        $this->syncFromQuote();
    }

    // This handler is necessary but empty because no additional $listeners handling is needed.
    public function handleEvent()
    {
    }

    public function updatedSelectedServices($value)
    {
        if (!is_array($this->selectedServices)) {
            $this->selectedServices = [];
        }

        $this->persistSelections();
        return $value;
    }

    private function syncFromQuote(): void
    {
        $quote = $this->checkoutSession->getQuote();
        $shippingAddress = $quote ? $quote->getShippingAddress() : null;

        $this->postcode = $shippingAddress ? (string)$shippingAddress->getPostcode() : null;
        $this->countryId = $shippingAddress ? (string)$shippingAddress->getCountryId() : null;
        $this->shippingMethod = $shippingAddress ? (string)$shippingAddress->getShippingMethod() : null;

        if ($this->shippingMethod !== self::METHOD_PROVIDING_SERVICES) {
            $this->enabled = false;
            $this->visible = false;
            $this->validated = true;
            $this->serviceData = [];
            $this->selectedServices = [];
            $this->excludedServiceData = [];
            $this->excludedServices = [];
            return;
        }

        $availability = $this->resolveAvailability();
        $this->enabled = $availability['enabled'];
        $this->serviceData = $availability['serviceData'];
        $this->excludedServiceData = $availability['excludedServiceData'];
        $this->excludedServices = $this->calculateExcludedServices($this->selectedServices, $this->excludedServiceData);
        $this->serviceData = $this->applyExcludedServices($this->serviceData, $this->excludedServices);
        $this->visible = $this->enabled && !empty($this->serviceData);
        $this->validated = true;

        // If selected services from availability differ from current, persist them
        if ($this->arraysHaveSameValues($this->selectedServices, $availability['selectedServices']) === false) {
            $this->selectedServices = $availability['selectedServices'];
            $this->persistSelections();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private
    function resolveAvailability(): array
    {
        $quote = $this->checkoutSession->getQuote();
        $subtotal = $quote ? (float)$quote->getSubtotal() : 0.0;
        $storeId = $this->storeManager->getStore()->getId();

        $selections = $this->checkoutSession->getDHLParcelShippingDeliveryServices();
        $selections = $this->deliveryServices->filterAllowedOnly($selections);

        $options = [];
        if (count($this->deliveryServices->getAllowedOptions()) > 0) {
            $options = $this->capabilityService->getOptions(
                $storeId,
                $this->countryId ?? '',
                $this->postcode ?? '',
                $this->deliveryServices->getToBusiness(),
                ['DOOR']
            );
        }

        $availability = $this->deliveryServices->getAvailability(
            $options,
            $subtotal,
            $selections,
            $storeId
        );

        return [
            'enabled'             => (bool)($availability->enabled ?? false),
            'serviceData'         => is_array($availability->serviceData ?? null) ? $availability->serviceData : [],
            'selectedServices'    => is_array($availability->selectedServices ?? null) ? $availability->selectedServices : [],
            'excludedServiceData' => is_array($availability->excludedServiceData ?? null) ? $availability->excludedServiceData : [],
        ];
    }

    /**
     * @param array<int, string> $selectedServices
     * @param array<string, array<int, string>> $excludedServiceData
     * @return array<int, string>
     */
    private
    function calculateExcludedServices(array $selectedServices, array $excludedServiceData): array
    {
        $excludedList = [];
        $selected = [];
        foreach ($selectedServices as $service) {
            if (isset($excludedServiceData[$service]) && is_array($excludedServiceData[$service])) {
                $selected[] = $service;
                $excludedList = array_merge($excludedList, $excludedServiceData[$service]);
            }
        }

        $excluded = [];
        foreach ($selected as $service) {
            if (!in_array($service, $excludedList, true) && isset($excludedServiceData[$service])) {
                $excluded = array_merge($excluded, $excludedServiceData[$service]);
            }
        }

        return array_values(array_unique($excluded));
    }

    /**
     * @param array<int, array<string, mixed>> $serviceData
     * @param array<int, string> $excludedServices
     * @return array<int, array<string, mixed>>
     */
    private
    function applyExcludedServices(array $serviceData, array $excludedServices): array
    {
        $updated = [];
        foreach ($serviceData as $service) {
            if (!is_array($service)) {
                continue;
            }

            $value = isset($service['value']) ? (string)$service['value'] : '';
            $service['enable'] = $value !== '' && !in_array($value, $excludedServices, true);
            $updated[] = $service;
        }

        return $updated;
    }

    private
    function persistSelections(): void
    {
        $selected = $this->deliveryServices->filterAllowedOnly($this->selectedServices);
        $excluded = $this->calculateExcludedServices($selected, $this->excludedServiceData);
        $services = [];

        foreach ($selected as $service) {
            if (!in_array($service, $excluded, true)) {
                $services[] = $service;
            }
        }

        $this->checkoutSession->setDHLParcelShippingDeliveryServices($services);
        $this->selectedServices = $selected;
        $this->excludedServices = $excluded;
        $this->serviceData = $this->applyExcludedServices($this->serviceData, $excluded);
        $this->validated = true;

        $this->notifySelectionUpdated();
    }

    private
    function notifySelectionUpdated(): void
    {
        if (method_exists($this, 'emit')) {
            $this->emit('delivery_services_updated');
        } elseif (method_exists($this, 'dispatch')) {
            $this->dispatch('delivery_services_updated');
        }

        if (method_exists($this, 'dispatchBrowserEvent')) {
            $this->dispatchBrowserEvent('dhlparcel:deliveryservices-updated');
        }
    }

    private
    function arraysHaveSameValues(array $a, array $b): bool
    {
        return count($a) === count($b)
            && empty(array_diff($a, $b))
            && empty(array_diff($b, $a));
    }
}
