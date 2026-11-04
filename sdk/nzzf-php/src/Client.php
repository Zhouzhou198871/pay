<?php
declare(strict_types=1);

namespace QingtianPay\\Nzzf;

use RuntimeException;

/**
 * Minimal NZZF merchant API client based on the V2 documentation supplied
 * to 晴天支付. All requests are POST application/x-www-form-urlencoded.
 */
final class Client
{
    private string $apiUrl;
    private string $pid;
    private string $merchantPrivateKey;
    private string $platformPublicKey;
    private int $timeout;

    public function __construct(array $config)
    {
        foreach (['apiurl', 'pid', 'merchant_private_key', 'platform_public_key'] as $required) {
            if (empty($config[$required]) || !is_string($config[$required])) {
                throw new RuntimeException('Missing SDK config: ' . $required);
            }
        }
        $this->apiUrl = rtrim($config['apiurl'], '/');
        $this->pid = $config['pid'];
        $this->merchantPrivateKey = $config['merchant_private_key'];
        $this->platformPublicKey = $config['platform_public_key'];
        $this->timeout = isset($config['timeout']) ? max(3, (int) $config['timeout']) : 15;
    }

    public function merchantInfo(): array
    {
        return $this->post('/api/merchant/info', []);
    }

    public function orders(array $filters = []): array
    {
        $allowed = ['offset', 'limit', 'status', 'out_trade_no'];
        $params = [];
        foreach ($allowed as $key) {
            if (array_key_exists($key, $filters)) {
                $params[$key] = $filters[$key];
            }
        }
        return $this->post('/api/merchant/orders', $params);
    }

    /**
     * Generic signed POST for additional endpoints once their exact contract
     * has been confirmed. Do not use undocumented endpoints in production.
     */
    public function post(string $path, array $params = []): array
    {
        if ($path === '' || $path[0] !== '/' || strpos($path, '//') === 0) {
            throw new RuntimeException('API path must be an absolute path beginning with one slash');
        }

        $payload = array_merge($params, [
            'pid' => $this->pid,
            'timestamp' => (string) time(),
            'sign_type' => 'RSA',
        ]);
        unset($payload['sign']);
        $payload['sign'] = Signer::sign($payload, $this->merchantPrivateKey);

        $ch = curl_init($this->apiUrl . $path);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($payload, '', '&', PHP_QUERY_RFC1738),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded',
                'Accept: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => min(8, $this->timeout),
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($ch);
        $curlError = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false) {
            throw new RuntimeException('NZZF request failed: ' . $curlError);
        }
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('NZZF returned invalid JSON (HTTP ' . $status . ')');
        }

        if (isset($decoded['sign']) && !Signer::verify($decoded, $this->platformPublicKey)) {
            throw new RuntimeException('NZZF response signature verification failed');
        }
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('NZZF HTTP error ' . $status . ': ' . $body);
        }
        return $decoded;
    }
}
