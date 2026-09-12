// Syntropic's launcher for the unmodified, pinned official CLI.
package main

import (
	"context"
	"github.com/larksuite/cli/cmd"
	_ "github.com/larksuite/cli/extension/credential/env"
	ext "github.com/larksuite/cli/extension/transport"
	"golang.org/x/net/http/httpproxy"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
)

const bridgeHost = "syntropic-system-network.invalid"

type networkProvider struct{}

func (networkProvider) Name() string                                         { return "syntropic-system-network" }
func (p networkProvider) ResolveInterceptor(context.Context) ext.Interceptor { return p }
func (networkProvider) PreRoundTrip(req *http.Request) func(*http.Response, error) {
	if os.Getenv("SYNTROPIC_NETWORK_SOCKET") == "" || req.URL.Hostname() == bridgeHost {
		return nil
	}
	proxyEnv := httpproxy.FromEnvironment()
	if proxyEnv.HTTPProxy != "" || proxyEnv.HTTPSProxy != "" || os.Getenv("ALL_PROXY") != "" || os.Getenv("all_proxy") != "" {
		return nil
	}
	bypass := (&httpproxy.Config{HTTPProxy: "http://proxy.invalid", HTTPSProxy: "http://proxy.invalid", NoProxy: proxyEnv.NoProxy}).ProxyFunc()
	proxy, err := bypass(req.URL)
	if err != nil || proxy == nil {
		return nil
	}
	original := *req.URL
	req.URL = &url.URL{Scheme: "http", Host: bridgeHost, Path: "/request", RawQuery: url.Values{"url": {original.String()}}.Encode()}
	req.Host = bridgeHost
	return func(resp *http.Response, _ error) {
		if resp != nil {
			resp.Request = req.Clone(req.Context())
			resp.Request.URL = &original
		}
	}
}
func configureNetwork() {
	socket := os.Getenv("SYNTROPIC_NETWORK_SOCKET")
	if socket == "" {
		return
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	directDial := transport.DialContext
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		if strings.HasPrefix(addr, bridgeHost+":") {
			return (&net.Dialer{}).DialContext(ctx, "unix", socket)
		}
		return directDial(ctx, network, addr)
	}
	proxyConfig := httpproxy.FromEnvironment()
	allProxy := os.Getenv("ALL_PROXY")
	if allProxy == "" {
		allProxy = os.Getenv("all_proxy")
	}
	if proxyConfig.HTTPProxy == "" {
		proxyConfig.HTTPProxy = allProxy
	}
	if proxyConfig.HTTPSProxy == "" {
		proxyConfig.HTTPSProxy = allProxy
	}
	proxyForURL := proxyConfig.ProxyFunc()
	directProxy := func(req *http.Request) (*url.URL, error) { return proxyForURL(req.URL) }
	transport.Proxy = func(req *http.Request) (*url.URL, error) {
		if req.URL.Hostname() == bridgeHost {
			return nil, nil
		}
		return directProxy(req)
	}
	http.DefaultTransport = transport
	ext.Register(networkProvider{})
}
func main() { configureNetwork(); os.Exit(cmd.Execute()) }
