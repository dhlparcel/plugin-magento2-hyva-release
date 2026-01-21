<?php
declare(strict_types=1);

namespace DHLParcel\ShippingHyva\Plugin;

use Hyva\Theme\ViewModel\Cookie as CookieViewModel;
use Magento\Framework\App\RequestInterface;

class CookieViewModelPlugin
{
    private RequestInterface $request;

    public function __construct(RequestInterface $request)
    {
        $this->request = $request;
    }

    /**
     * Force host-only cookie on local hosts and test env to avoid browsers rejecting Domain attribute.
     */
    public function afterGetDomain(CookieViewModel $subject, string $result): string
    {
        $host = $this->request->getHttpHost();

        $isLocalHost = $host === 'localhost'
            || $host === '127.0.0.1'
            || $host === '0.0.0.0'
            || (bool)preg_match('/\\.dhlparcel\\.nl$/i', $host)
            || (bool)preg_match('/\\.local\\.test$/i', $host);


        return $isLocalHost ? '' : $result;
    }
}
