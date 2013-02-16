require 'rubygems'
require 'sinatra'
require 'net/http'
require 'uri'

ALLOW_DOMAIN_LIST = ['amzn.to', 'bit.ly', 'goo.gl', 'j.mp', 'ow.ly', 't.co', 'tinyurl.com', 'dlvr.it']

def expand_url(url)
  uri = URI.parse(url)
  if not ALLOW_DOMAIN_LIST.include?(uri.host)
    raise "This domain is not allowed."
  end
  Net::HTTP.start(uri.host, uri.port) do |io|
    r = io.head(uri.path)
    r['Location'] || uri.to_s
  end
end

get '/' do
  headers 'Content-Type' => "text/plain;charset=utf-8",
    'Access-Control-Allow-Origin' => 'http://www.crowy.net',
    #'Access-Control-Allow-Origin' => 'http://localhost:8081',
    'Access-Control-Allow-Headers' => 'Content-Type',
    'Access-Control-Allow-Methods' => 'GET,OPTIONS',
    'Access-Control-Allow-Credentials' => 'true'
  expand_url(params[:url])
end