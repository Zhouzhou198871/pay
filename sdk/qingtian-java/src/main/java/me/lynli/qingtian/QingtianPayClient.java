package me.lynli.qingtian;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.*;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/** Minimal JDK 11+ client for Qingtian Pay V1 (MD5) and V2 (SHA256withRSA). */
public final class QingtianPayClient {
  private final String baseUrl, merchantNo, v1Key, v2PrivateKeyPem;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
  public QingtianPayClient(String merchantNo, String v1Key, String v2PrivateKeyPem) {
    this("https://pay.lynli.me", merchantNo, v1Key, v2PrivateKeyPem);
  }
  public QingtianPayClient(String baseUrl, String merchantNo, String v1Key, String v2PrivateKeyPem) {
    this.baseUrl=baseUrl.replaceAll("/$",""); this.merchantNo=Objects.requireNonNull(merchantNo);
    this.v1Key=v1Key; this.v2PrivateKeyPem=v2PrivateKeyPem;
  }
  private String canonical(Map<String,?> params, boolean keepEmpty) {
    return params.keySet().stream().filter(k -> !k.equals("sign"))
      .filter(k -> params.get(k)!=null && (keepEmpty || !params.get(k).toString().isEmpty()))
      .sorted().map(k -> k+"="+params.get(k).toString()).collect(Collectors.joining("&"));
  }
  public String signV1(Map<String,?> params) throws Exception {
    if(v1Key==null) throw new IllegalStateException("V1 key required");
    byte[] digest=MessageDigest.getInstance("MD5").digest((canonical(params,false)+"&key="+v1Key).getBytes(StandardCharsets.UTF_8));
    return HexFormat.of().formatHex(digest);
  }
  public String signV2(Map<String,?> params) throws Exception {
    if(v2PrivateKeyPem==null) throw new IllegalStateException("V2 private key required");
    String body=v2PrivateKeyPem.replaceAll("-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s","");
    PrivateKey key=KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
    Signature signer=Signature.getInstance("SHA256withRSA"); signer.initSign(key);
    signer.update(canonical(params,true).getBytes(StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(signer.sign());
  }
  public String createOrderV1(Map<String,?> order) throws Exception { return createOrder(order,false); }
  public String createOrderV2(Map<String,?> order) throws Exception { return createOrder(order,true); }
  private String createOrder(Map<String,?> order,boolean rsa) throws Exception {
    Map<String,Object> params=new LinkedHashMap<>(); params.putAll(order);
    params.put("merchant_no",merchantNo); params.put("timestamp",Long.toString(System.currentTimeMillis()/1000));
    params.put("sign",rsa?signV2(params):signV1(params));
    return post(rsa?"/api/v2/payments":"/api/v1/payments",toJson(params));
  }
  private String toJson(Map<String,?> values) {
    return values.entrySet().stream().map(e -> jsonString(e.getKey())+":"+jsonValue(e.getValue())).collect(Collectors.joining(",","{","}"));
  }
  private String jsonValue(Object value) {
    if(value==null) return "null";
    if(value instanceof Number || value instanceof Boolean) return value.toString();
    return jsonString(value.toString());
  }
  private String jsonString(String value) {
    StringBuilder out=new StringBuilder("\"");
    for(char ch:value.toCharArray()) {
      switch(ch) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> { if(ch<0x20) out.append(String.format("\\u%04x",(int)ch)); else out.append(ch); }
      }
    }
    return out.append('"').toString();
  }
  private String post(String path,String jsonBody) throws Exception {
    HttpRequest request=HttpRequest.newBuilder(URI.create(baseUrl+path)).timeout(Duration.ofSeconds(20))
      .header("Content-Type","application/json").header("Accept","application/json")
      .POST(HttpRequest.BodyPublishers.ofString(jsonBody,StandardCharsets.UTF_8)).build();
    HttpResponse<String> response=http.send(request,HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    if(response.statusCode()<200||response.statusCode()>=300) throw new IllegalStateException("Qingtian API HTTP "+response.statusCode()+": "+response.body());
    return response.body();
  }
}
