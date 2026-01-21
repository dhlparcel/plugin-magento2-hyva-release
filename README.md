# DHL eCommerce Hyvä Checkout Compatibility for Magento 2
---------------------------
This plugin provides compatibility between the DHL Parcel Shipping module (`dhlparcel/magento2-plugin`) and the Hyvä Checkout theme (`hyva-themes/magento2-hyva-checkout`). It enables DHL-specific shipping functionality within the Hyvä checkout experience.

**Note:** This is a companion module. You must have both the [DHL Parcel Shipping plugin](https://github.com/dhlparcel/plugin-magento2-shipping) and [Hyvä Checkout](https://www.hyva.io/hyva-checkout.html) installed for this module to work.

## Features
- **ServicePoint Locator** - Allows customers to select a DHL ServicePoint (pickup location) during checkout
- **Delivery Times Selection** - Enables customers to choose preferred delivery time slots (Netherlands only)
- **Delivery Services Selection** - Provides extra delivery service options (evening delivery, no-neighbor delivery, etc.)

## Requirements
- Magento 2.x
- `dhlparcel/magento2-plugin` ^1.0.52
- `hyva-themes/magento2-hyva-checkout` ^1.0 || ^2.0

# Install / Update
## Update instructions
- If you've installed a previous version with zip extraction, please remove the files found in `app/code/DHLParcel/ShippingHyva` and proceed with the installation instructions (can be either composer or zip extraction).

- If you're installed a previous version with composer with the recommended version range, just run the following commands to complete the update  
  `composer update dhlparcel/magento2-plugin-hyva:~1.0.0`  
  `php bin/magento setup:upgrade`  
  `php bin/magento setup:di:compile (only for production environments)`

## Installation with composer
- Ensure you have the required dependencies installed:  
  `composer require dhlparcel/magento2-plugin:~1.0.0`  
  `composer require hyva-themes/magento2-hyva-checkout` (requires Hyvä license)

- Add the plugin to your composer with the command (recommended version range)  
  `composer require dhlparcel/magento2-plugin-hyva:~1.0.0`

- Enable the DHL Hyvä module by executing the following from the Magento root:  
  `php bin/magento module:enable DHLParcel_ShippingHyva`

- Upgrade the database  
  `php bin/magento setup:upgrade`

- When running in production, complete the installation by recompiling  
  `php bin/magento setup:di:compile`

## Installation with zip extraction
- Go to the Magento 2 directory

- Ensure you have the main DHL Parcel Shipping plugin installed first (see the [main plugin documentation](https://github.com/dhlparcel/plugin-magento2-shipping))

- Extract the contents of the `magento2-hyva.zip` file in a new directory: `app/code/DHLParcel/ShippingHyva`  
  (If you're upgrading, remove the old files first)

- Enable the DHL Hyvä module by executing the following from the Magento root:  
  `php bin/magento module:enable DHLParcel_ShippingHyva`

- Upgrade the database  
  `php bin/magento setup:upgrade`

- When running in production, complete the installation by recompiling  
  `php bin/magento setup:di:compile`

## Supported Shipping Methods
This module provides Hyvä Checkout integration for the following DHL shipping methods:

| Method | Description |
|--------|-------------|
| `dhlparcel_door` | Standard door delivery |
| `dhlparcel_evening` | Evening delivery |
| `dhlparcel_no_neighbour` | No neighbor delivery |
| `dhlparcel_no_neighbour_evening` | Evening + no neighbor |
| `dhlparcel_servicepoint` | ServicePoint pickup |

## Regional Notes
- **Delivery Times**: Only available for Netherlands (NL) addresses
- **General**: This plugin is designed for shipping from the Benelux region (Belgium, Netherlands, Luxembourg)
