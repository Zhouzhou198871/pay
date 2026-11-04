<?php
return [
    // NZZF API base URL
    'apiurl' => 'https://nzzf.org',
    'pid' => 'YOUR_MERCHANT_ID',

    // Paste the complete PEM key or the raw Base64 key body.
    // Never commit real private keys to source control.
    'platform_public_key' => <<<'KEY'
YOUR_PLATFORM_PUBLIC_KEY
KEY,
    'merchant_private_key' => <<<'KEY'
YOUR_MERCHANT_PRIVATE_KEY
KEY,

    'timeout' => 15,
];
