<?php
declare(strict_types=1);

namespace QingtianPay\\Nzzf;

use InvalidArgumentException;
use RuntimeException;

/**
 * NZZF V2 SHA256WithRSA signer.
 * Canonical string: non-empty scalar parameters sorted by ASCII key;
 * sign, sign_type and array/object parameters are excluded.
 */
final class Signer
{
    public static function canonicalize(array $params): string
    {
        $filtered = [];
        foreach ($params as $key => $value) {
            if ($key === 'sign' || $key === 'sign_type' || is_array($value) || is_object($value) || $value === null || $value === '') {
                continue;
            }
            if (!is_scalar($value)) {
                continue;
            }
            $filtered[(string) $key] = (string) $value;
        }

        uksort($filtered, 'strcmp');
        $pairs = [];
        foreach ($filtered as $key => $value) {
            $pairs[] = $key . '=' . $value;
        }
        return implode('&', $pairs);
    }

    public static function sign(array $params, string $merchantPrivateKey): string
    {
        $key = self::loadPrivateKey($merchantPrivateKey);
        $signature = '';
        $ok = openssl_sign(self::canonicalize($params), $signature, $key, OPENSSL_ALGO_SHA256);
        if (!$ok) {
            throw new RuntimeException('RSA-SHA256 signing failed: ' . self::opensslError());
        }
        return base64_encode($signature);
    }

    public static function verify(array $params, string $platformPublicKey): bool
    {
        if (empty($params['sign']) || !is_string($params['sign'])) {
            return false;
        }
        $key = self::loadPublicKey($platformPublicKey);
        $signature = base64_decode($params['sign'], true);
        if ($signature === false) {
            return false;
        }
        return openssl_verify(self::canonicalize($params), $signature, $key, OPENSSL_ALGO_SHA256) === 1;
    }

    private static function loadPrivateKey(string $key)
    {
        $key = self::normalizeKey($key, 'PRIVATE');
        $resource = openssl_pkey_get_private($key);
        if ($resource === false) {
            throw new InvalidArgumentException('Invalid merchant RSA private key: ' . self::opensslError());
        }
        return $resource;
    }

    private static function loadPublicKey(string $key)
    {
        $key = self::normalizeKey($key, 'PUBLIC');
        $resource = openssl_pkey_get_public($key);
        if ($resource === false) {
            throw new InvalidArgumentException('Invalid platform RSA public key: ' . self::opensslError());
        }
        return $resource;
    }

    private static function normalizeKey(string $key, string $kind): string
    {
        $key = trim(str_replace(["\\r\\n", "\\r"], "\\n", $key));
        if (strpos($key, '-----BEGIN') !== false) {
            return $key;
        }
        $label = $kind === 'PRIVATE' ? 'PRIVATE KEY' : 'PUBLIC KEY';
        $body = preg_replace('/\\s+/', '', $key);
        return "-----BEGIN {$label}-----\\n" . chunk_split((string) $body, 64, "\\n") . "-----END {$label}-----";
    }

    private static function opensslError(): string
    {
        $message = openssl_error_string();
        return $message !== false ? $message : 'unknown OpenSSL error';
    }
}
