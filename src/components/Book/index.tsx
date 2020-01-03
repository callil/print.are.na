import React, { useState, useEffect, useRef, useCallback } from "react"
import styled from "styled-components"
import { useLocation } from "react-router-dom"
import { renderToString } from "react-dom/server"
import { RouteComponentProps } from "react-router"
import Bindery, { Controls } from "@broskoski/bindery"
import { API } from "lib/api"
import parseLocation from "lib/parseLocation"
import { parseChannelContents } from "lib/parseChannelContents"
import { Block, Channel } from "../../types"

import LoadingPage from "components/LoadingPage"

import PageHeader from "components/PageHeader"
import Page from "components/Page"
import SectionPage from "components/SectionPage"
import AboutPage from "components/AboutPage"
import TableOfContents from "components/TableOfContents"
import TitlePage from "components/TitlePage"

import CoverSpread from "components/CoverSpread"

import { URLOptions } from "types"

const BookContainer = styled.div`
  opacity: 0;
`

interface BookProps {
  channel: Channel
  contents: Block[]
}

const Book: React.FC<BookProps> = ({ channel, contents }) => {
  const bookRef = useRef(null)
  const [rendered, setRendered] = useState(false)
  const [mode, setMode] = useState("interior")
  const location = useLocation()
  const defaultOptions = {
    author: true,
    description: true,
    source: true,
  }
  const options: URLOptions = {
    ...defaultOptions,
    ...parseLocation(location.search.replace("?", "")),
  }

  const handleClick = useCallback(() => {
    setMode("cover")
  }, [setMode])

  useEffect(() => {
    if (bookRef.current && !rendered) {
      const header = Bindery.RunningHeader({
        render: (page: any) => {
          return renderToString(<PageHeader page={page} />)
        },
      })

      const coverButton = Controls.btnMain(
        {
          onclick: handleClick,
        },
        "Cover"
      )
      Bindery.makeBook({
        content: bookRef.current,
        controlOptions: {
          layout: false,
          views: true,
          marks: false,
          extraControls: coverButton,
        },
        printSetup: {
          layout: Bindery.Layout.PAGES,
          paper: Bindery.Paper.AUTO,
          bleed: "0.25in",
        },
        pageSetup: {
          size: {
            width: "4.25in",
            height: "6.875in",
          },
          margin: {
            top: "0.3in",
            inner: "0.65in",
            outer: "0.35in",
            bottom: "0.35in",
          },
        },
        rules: [
          // TOC
          Bindery.PageReference({
            selector: ".toc-page a",
            replace: (element: HTMLAnchorElement, pageNumber: number) => {
              let number = document.createElement("div")
              number.innerHTML = `<div>${pageNumber}</div>`
              element.appendChild(number)
              return element
            },
          }),
          Bindery.PageBreak({
            selector: ".toc-page hr",
            position: "before",
            continue: "left",
          }),
          // Start of book contents
          Bindery.PageBreak({
            selector: ".contents-start",
            position: "before",
            continue: "left",
          }),
          // Normal page
          header,
          Bindery.PageBreak({
            selector: "hr",
            position: "after",
          }),
        ],
      })
      setRendered(true)
    }
  }, [bookRef, defaultOptions, handleClick, rendered])

  const hasTOC = contents.filter(b => !!b.title).length > 0
  const hasAboutPage = channel.metadata && channel.metadata.description !== ""
  const author =
    (channel.owner.class === "User"
      ? channel.owner.username
      : channel.owner.name) || ""

  return (
    <>
      {mode === "cover" && (
        <CoverSpread
          bookRef={bookRef}
          channel={channel}
          onClose={() => {
            setMode("book")
          }}
        />
      )}
      <BookContainer className="book-container" ref={bookRef}>
        <TitlePage title={channel.title} author={author} channel={channel} />

        {hasAboutPage && (
          <>
            <SectionPage title="About" />
            <AboutPage
              description={channel.metadata && channel.metadata.description}
            />
          </>
        )}

        {hasTOC && options.toc && (
          <>
            <SectionPage title="Table of Contents" />
            <TableOfContents blocks={contents} />
          </>
        )}

        <div className="contents-start" />

        {contents.reverse().map(b => (
          <Page block={b} key={b.id} options={options} />
        ))}
      </BookContainer>
    </>
  )
}

type BookWrapperProps = RouteComponentProps<{ slug: string }>

const BookWrapper: React.FC<BookWrapperProps> = ({
  match: {
    params: { slug },
  },
}) => {
  const [channel, setChannel] = useState<any | null>(null)
  const [contents, setContents] = useState<null | Block[]>(null)
  const [totalPages, setTotalPages] = useState<null | number>(null)

  const api = new API()

  useEffect(() => {
    if (!channel) {
      api
        .getFullChannel(slug, {
          onGetTotal: setTotalPages,
        })
        .then(channel => setChannel(channel))
    }
  }, [channel, slug, api])

  useEffect(() => {
    if (channel && channel.contents) {
      parseChannelContents(channel.contents).then(parsedContents =>
        setContents(parsedContents)
      )
    }
  }, [channel])

  return (
    <>
      {(!channel || !contents) && (
        <LoadingPage slug={slug} totalPages={totalPages} />
      )}
      {channel && contents && <Book channel={channel} contents={contents} />}
    </>
  )
}

export default BookWrapper
