package main

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSystemBridgeCarriesOriginalRequest(t *testing.T) {
	for _, key := range []string{"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy", "NO_PROXY", "no_proxy"} {
		t.Setenv(key, "")
	}
	directory, err := os.MkdirTemp("/tmp", "sf-net-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(directory)
	socket := filepath.Join(directory, "bridge.sock")
	listener, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("url") != "https://open.feishu.cn/open-apis/test?x=1" {
			t.Error("lost logical URL")
		}
		if r.Header.Get("Authorization") != "Bearer fixture" {
			t.Error("lost authorization")
		}
		body, _ := io.ReadAll(r.Body)
		if string(body) != "fixture body" {
			t.Error("lost body")
		}
		w.Write([]byte("response"))
	})}
	go server.Serve(listener)
	defer server.Close()
	t.Setenv("SYNTROPIC_NETWORK_SOCKET", socket)
	previous := http.DefaultTransport
	defer func() { http.DefaultTransport = previous }()
	configureNetwork()
	req, _ := http.NewRequestWithContext(context.Background(), "POST", "https://open.feishu.cn/open-apis/test?x=1", strings.NewReader("fixture body"))
	req.Header.Set("Authorization", "Bearer fixture")
	post := (networkProvider{}).PreRoundTrip(req)
	if req.URL.Hostname() != bridgeHost {
		t.Fatal("bridge not used")
	}
	resp, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	post(resp, err)
	defer resp.Body.Close()
	if resp.Request.URL.Hostname() != "open.feishu.cn" {
		t.Fatal("logical response URL not restored")
	}
	body, _ := io.ReadAll(resp.Body)
	if string(body) != "response" {
		t.Fatal("response lost")
	}
}
func TestBypassAndExplicitProxy(t *testing.T) {
	t.Setenv("SYNTROPIC_NETWORK_SOCKET", "/unused")
	for _, key := range []string{"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy", "NO_PROXY", "no_proxy"} {
		t.Setenv(key, "")
	}
	for _, raw := range []string{"http://127.0.0.1:1234/a", "http://localhost/a", "http://[::1]/a"} {
		req, _ := http.NewRequest("GET", raw, nil)
		(networkProvider{}).PreRoundTrip(req)
		if req.URL.String() != raw {
			t.Fatal("loopback must stay direct")
		}
	}
	t.Setenv("NO_PROXY", ".feishu.cn")
	req, _ := http.NewRequest("GET", "https://open.feishu.cn/a", nil)
	(networkProvider{}).PreRoundTrip(req)
	if req.URL.Hostname() == bridgeHost {
		t.Fatal("NO_PROXY ignored")
	}
	t.Setenv("NO_PROXY", "")
	t.Setenv("HTTPS_PROXY", "http://proxy.example:8888")
	req.URL, _ = url.Parse("https://open.feishu.cn/a")
	(networkProvider{}).PreRoundTrip(req)
	if req.URL.Hostname() == bridgeHost {
		t.Fatal("explicit proxy overridden")
	}
}
