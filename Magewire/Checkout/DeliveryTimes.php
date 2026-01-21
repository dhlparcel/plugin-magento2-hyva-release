<?php

namespace DHLParcel\ShippingHyva\Magewire\Checkout;

use DHLParcel\Shipping\Model\Service\DeliveryTimes as DHLParcelDeliveryTimes;
use Magewirephp\Magewire\Component;
use Magento\Checkout\Model\Session as CheckoutSession;
use Psr\Log\LoggerInterface;

class DeliveryTimes extends Component
{
    // Events that should trigger a refresh of this component (they call hydrate implicitly)
    protected $listeners = [
        'shipping_method_selected' => 'handleEvent',
        'shipping_address_saved'   => 'handleEvent',
        'delivery_services_updated' => 'handleEvent',

    ];

    private const METHODS_REQUIRING_DELIVERY_TIMES = [
        'dhlparcel_door',
        'dhlparcel_evening',
        'dhlparcel_no_neighbour',
        'dhlparcel_no_neighbour_evening',
    ];


    protected DHLParcelDeliveryTimes $deliveryTimes;
    protected CheckoutSession $checkoutSession;
    protected LoggerInterface $logger;

    public bool $enabled = false;
    public bool $visible = false;
    public ?string $shippingMethod = null;
    public ?string $postcode = null;
    public ?string $countryId = null;
    public ?string $selectedIdentifier = null;

    /**
     * List of options for the select, each item:
     * - identifier (string)
     * - label (string)
     * - date (string, d-m-Y)
     * - startTime (string, HHMM)
     * - endTime (string, HHMM)
     *
     * @var array<int, array<string, string>>
     */
    public array $options = [];

    /**
     * @param DHLParcelDeliveryTimes $deliveryTimes
     * @param CheckoutSession $checkoutSession
     */
    public function __construct(
        DHLParcelDeliveryTimes $deliveryTimes,
        CheckoutSession        $checkoutSession,
        LoggerInterface        $logger
    ) {
        $this->deliveryTimes = $deliveryTimes;
        $this->checkoutSession = $checkoutSession;
        $this->logger = $logger;
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

    public function updatedSelectedIdentifier($value)
    {
        $this->applySelectionByIdentifier($value);
        return $value;
    }

    public function isDeliveryTimesEnabled(): bool
    {
        return (bool)($this->deliveryTimes->isEnabled()
            && $this->deliveryTimes->displayFrontend()
            && !$this->deliveryTimes->notInStock());
    }

    private function syncFromQuote(): void
    {
        $quote = $this->checkoutSession->getQuote();
        $shippingAddress = $quote ? $quote->getShippingAddress() : null;

        $this->postcode = $shippingAddress ? (string)$shippingAddress->getPostcode() : null;
        $this->countryId = $shippingAddress ? (string)$shippingAddress->getCountryId() : null;
        $this->shippingMethod = $shippingAddress ? (string)$shippingAddress->getShippingMethod() : null;
        $this->enabled = $this->isDeliveryTimesEnabled();

        $requiresTimes = $this->enabled
            && $this->countryId === 'NL'
            && $this->shippingMethod
            && in_array($this->shippingMethod, self::METHODS_REQUIRING_DELIVERY_TIMES, true);

        if (!$requiresTimes) {
            $this->visible = false;
            $this->options = [];
            $this->clearSelection();
            return;
        } else if (!$this->postcode || !$this->countryId) {
            $this->visible = false;
            $this->options = [];
            $this->clearSelection();
            return;
        }

        $deliveryTimes = $this->deliveryTimes->getTimeFrames($this->postcode, $this->countryId);
        $dayDeliveryDayTimeOptions = $this->mapDeliveryTimes(
            $this->deliveryTimes->filterTimeFrames($deliveryTimes, true)
        );
        $eveningDeliveryTimeOptions = $this->mapDeliveryTimes(
            $this->deliveryTimes->filterTimeFrames($deliveryTimes, false)
        );

        $selectedServices = $this->checkoutSession->getDHLParcelShippingDeliveryServices();
        $selectedServices = is_array($selectedServices) ? $selectedServices : [];

        $useEvening = (bool)(
            ($this->shippingMethod && strpos($this->shippingMethod, 'evening') !== false)
            || in_array('EVE', $selectedServices, true)
        );

        $this->options = $useEvening ? $eveningDeliveryTimeOptions : $dayDeliveryDayTimeOptions;
        $this->visible = true;

        if (empty($this->options)) {
            return;
        }

        $currentIdentifier = $this->checkoutSession->getDHLParcelShippingDeliveryTimesIdentifier();
        $currentIdentifier = is_string($currentIdentifier) && $currentIdentifier !== '' ? $currentIdentifier : null;

        if ($currentIdentifier && $this->findOptionByIdentifier($currentIdentifier)) {
            $this->selectedIdentifier = $currentIdentifier;
            return;
        }

        $first = $this->options[0]['identifier'] ?? null;
        if (!$first) {
            return;
        }

        $this->selectedIdentifier = $first;
        $this->applySelectionByIdentifier($first);
    }

    /**
     * @param \DHLParcel\Shipping\Model\Data\DeliveryTime[] $deliveryTimes
     * @return array<int, array<string, string>>
     */
    private function mapDeliveryTimes(array $deliveryTimes): array
    {
        $mapped = [];

        foreach ($deliveryTimes as $deliveryTime) {
            if (!$deliveryTime || empty($deliveryTime->identifier) || empty($deliveryTime->displayLabel)) {
                continue;
            }

            $date = $deliveryTime->source && isset($deliveryTime->source->deliveryDate)
                ? (string)$deliveryTime->source->deliveryDate
                : '';
            $startTime = $deliveryTime->source && isset($deliveryTime->source->startTime)
                ? (string)$deliveryTime->source->startTime
                : '';
            $endTime = $deliveryTime->source && isset($deliveryTime->source->endTime)
                ? (string)$deliveryTime->source->endTime
                : '';

            if ($date === '' || $startTime === '' || $endTime === '') {
                continue;
            }

            $mapped[] = [
                'identifier' => (string)$deliveryTime->identifier,
                'label'      => (string)$deliveryTime->displayLabel,
                'date'       => $date,
                'startTime'  => $startTime,
                'endTime'    => $endTime,
            ];
        }

        return $mapped;
    }

    private function findOptionByIdentifier(string $identifier): ?array
    {
        foreach ($this->options as $option) {
            if (isset($option['identifier']) && $option['identifier'] === $identifier) {
                return $option;
            }
        }

        return null;
    }

    private function applySelectionByIdentifier(?string $identifier): void
    {
        if (!$identifier) {
            $this->clearSelection();
            return;
        }

        $option = $this->findOptionByIdentifier($identifier);
        if (!$option) {
            $this->clearSelection();
            return;
        }

        $this->checkoutSession->setDHLParcelShippingDeliveryTimesIdentifier($option['identifier']);
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesDate($option['date']);
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesStartTime($option['startTime']);
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesEndTime($option['endTime']);
    }

    private function clearSelection(): void
    {
        $this->selectedIdentifier = null;
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesIdentifier(null);
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesDate(null);
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesStartTime(null);
        $this->checkoutSession->setDHLParcelShippingDeliveryTimesEndTime(null);
    }
}
