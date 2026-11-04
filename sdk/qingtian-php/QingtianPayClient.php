<?php
declare(strict_types=1);
namespace QingtianPay;
use RuntimeException;

final class QingtianPayClient {
    public function __construct(private string $baseUrl, private string $merchantNo, private ?string $v1Key = null, private ?string $v2PrivateKey = null) {
        $this->baseUrl = rtrim($this->baseUrl, '/');
    }
    private function canonical(array $params, bool $keepEmpty): string {
        unset($params['sign']);
        foreach ($params as $k => $v) {
            if (!is_scalar($v) || (!$keepEmpty && ($v === null || $v === ''))) unset($params[$k]);
            else $params[$k] = (string)$v;
        }
        uksort($params, 'strcmp');
        $pairs=[]; foreach($params as $k=>$v) $pairs[]=$k.'='.$v;
        return implode('&',$pairs);
    }
    public function signV1(array $params): string {
        if (!$this->v1Key) throw new RuntimeException('V1 API key is required');
        return md5($this->canonical($params,false).'&key='.$this->v1Key);
    }
    public function signV2(array $params): string {
        if (!$this->v2PrivateKey) throw new RuntimeException('V2 RSA private key is required');
        $key=openssl_pkey_get_private($this->v2PrivateKey);
        if (!$key) throw new RuntimeException('Invalid PKCS#8 RSA private key');
        if (!openssl_sign($this->canonical($params,true),$signature,$key,OPENSSL_ALGO_SHA256)) throw new RuntimeException('RSA-SHA256 signing failed');
        return base64_encode($signature);
    }
    public function createOrderV1(array $order): array { return $this->post('/api/v1/payments',$this->signed($order,false)); }
    public function createOrderV2(array $order): array { return $this->post('/api/v2/payments',$this->signed($order,true)); }
    private function signed(array $order,bool $rsa): array {
        $params=array_merge($order,['merchant_no'=>$this->merchantNo,'timestamp'=>(string)time()]);
        $params['sign']=$rsa?$this->signV2($params):$this->signV1($params);
        return $params;
    }
    private function post(string $path,array $payload): array {
        $ch=curl_init($this->baseUrl.$path);
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>20,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2]);
        $body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$error=curl_error($ch);curl_close($ch);
        if($body===false) throw new RuntimeException('HTTP request failed: '.$error);
        $data=json_decode($body,true);if(!is_array($data)) throw new RuntimeException('Invalid JSON response (HTTP '.$status.')');
        if($status<200||$status>=300) throw new RuntimeException('Qingtian API error (HTTP '.$status.'): '.($data['message']??'request failed'));
        return $data;
    }
}
