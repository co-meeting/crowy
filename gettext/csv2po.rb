require "csv"
require 'fileutils'

headers = []
msgs = {}
CSV.foreach("i18n_messages.csv", :headers => true) do |row|
  headers = row.headers
  msgs[row[0]] = {}
  row.each{|header,field|
    msgs[row[0]][header] = field
  }
end

def merge(msgs, lang)
  FileUtils.cp "../src/conf/locale/#{lang}/LC_MESSAGES/django.po", "../src/conf/locale/#{lang}/LC_MESSAGES/django.po.bak"
  merged = File.open("../src/conf/locale/#{lang}/LC_MESSAGES/django.po",'w')
  File::open("../src/conf/locale/#{lang}/LC_MESSAGES/django.po.bak") {|f|
    status = 0 # 1=msgid, 2=msgstr
    msgid = ""
    msgstr = ""
    
    f.each{ |line|
      if /^msgid "(.*)"$/ =~ line
        status = 1
        msgid += $1
        merged.puts line
      elsif /^msgstr "(.*)"$/ =~ line
        status = 2
        msgstr += $1
        if msgid == ""
          merged.puts line
        end
      elsif /^"(.*)"$/ =~ line
        if status == 1
          msgid += $1
          merged.puts line
        elsif status == 2
          msgstr += $1
          if msgid == ""
            merged.puts line
          end
        end
      elsif line == "\n"
        if msgid.length > 0 && msgs[msgid] && msgs[msgid][lang]
          msgstr = msgs[msgid][lang].gsub("\n","")
        end
        if msgid.length > 0
          merged.puts "msgstr \"#{msgstr}\""
        end
        merged.puts line
        msgid = ""
        msgstr = ""
        status = 0
      else
        merged.puts line
      end
    }
    if msgid.length > 0
      if msgid.length > 0 && msgs[msgid] && msgs[msgid][lang]
        msgstr = msgs[msgid][lang].gsub("\n","")
      end
      if msgid.length > 0
        merged.puts "msgstr \"#{msgstr}\""
      end
    end
    print "#{lang} was merged.\n"
  }
  merged.close
end

headers.each{|header|
  if header != "key"
    merge(msgs, header)
  end
}